import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SimulatorForm } from "../SimulatorForm";

// Mock the TaxEngine module to avoid file resolution and complex calculations in JSDOM tests
jest.mock("@/tax/index.js", () => ({
  simulateTaxes: jest.fn().mockReturnValue({
    bestRegime: {
      name: "Simples Nacional",
      annualTax: 50000,
      effectiveRate: 0.10,
    },
    savingsComparedToWorst: {
      annual: 12000,
      monthly: 1000,
    },
  }),
}), { virtual: true });

describe("SimulatorForm Component", () => {
  let mockFetch: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock the global fetch for CNPJ API calls
    mockFetch = jest.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ nome: "Empresa Teste LTDA" }),
      })
    );
    global.fetch = mockFetch;
  });

  // Test Case 1: Render
  test("renders Step 1 with CNPJ input", () => {
    render(<SimulatorForm onRegister={jest.fn()} />);
    
    const cnpjInput = screen.getByLabelText("CNPJ da empresa");
    expect(cnpjInput).toBeInTheDocument();
    
    const submitButton = screen.getByRole("button", { name: /começar/i });
    expect(submitButton).toBeInTheDocument();
  });

  // Test Case 2: Transition 1
  test("transitions to Step 2 after valid CNPJ input and API success", async () => {
    render(<SimulatorForm onRegister={jest.fn()} />);
    
    const cnpjInput = screen.getByLabelText("CNPJ da empresa");
    
    // Simulate valid CNPJ input (14 digits)
    fireEvent.change(cnpjInput, { target: { value: "12345678000195" } });
    
    // Check that fetch was triggered for the CNPJ
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("12345678000195"));
    });

    // Check that the component transitioned to Step 2
    // It should render the company name returned by API and the Faturamento input
    const companyTitle = await screen.findByText("Empresa Teste LTDA", {}, { timeout: 1500 });
    expect(companyTitle).toBeInTheDocument();
    
    const faturamentoInput = screen.getByLabelText("Faturamento anual da empresa");
    expect(faturamentoInput).toBeInTheDocument();
  });

  // Test Case 3: Transition 2
  test("transitions to Step 3 after revenue input and checks if loading state appears", async () => {
    render(<SimulatorForm onRegister={jest.fn()} />);
    
    // Transition to Step 2
    const cnpjInput = screen.getByLabelText("CNPJ da empresa");
    fireEvent.change(cnpjInput, { target: { value: "12345678000195" } });
    await screen.findByText("Empresa Teste LTDA", {}, { timeout: 1500 });
    
    // Step 2: Fill out revenue
    const faturamentoInput = screen.getByLabelText("Faturamento anual da empresa");
    fireEvent.change(faturamentoInput, { target: { value: "1000000" } });
    
    // Click button to simulate and analyze
    const analyzeButton = screen.getByRole("button", { name: /analisar/i });
    fireEvent.click(analyzeButton);
    
    // Verify pulsing loading state ("Analisando NCMs...") appears
    const loadingState = screen.getByLabelText("Carregando análise de NCMs");
    expect(loadingState).toBeInTheDocument();
    expect(screen.getByText("Analisando NCMs...")).toBeInTheDocument();
    
    // Verify transition to Step 3 (gated content corporative email)
    const emailInput = await screen.findByLabelText("E-mail corporativo", {}, { timeout: 1500 });
    expect(emailInput).toBeInTheDocument();
  });

  // Test Case 4: Submission
  test("submits final email form, calls the expected handler and prevents default behavior", async () => {
    const mockOnRegister = jest.fn();
    const mockOnSubmit = jest.fn();
    
    render(<SimulatorForm onRegister={mockOnRegister} onSubmit={mockOnSubmit} />);
    
    // Step 1: Transition to Step 2
    const cnpjInput = screen.getByLabelText("CNPJ da empresa");
    fireEvent.change(cnpjInput, { target: { value: "12345678000195" } });
    await screen.findByText("Empresa Teste LTDA", {}, { timeout: 1500 });
    
    // Step 2: Transition to Step 3
    const faturamentoInput = screen.getByLabelText("Faturamento anual da empresa");
    fireEvent.change(faturamentoInput, { target: { value: "100000000" } });
    fireEvent.click(screen.getByRole("button", { name: /analisar/i }));
    
    // Step 3: Fill email and submit
    const emailInput = await screen.findByLabelText("E-mail corporativo", {}, { timeout: 1500 });
    fireEvent.change(emailInput, { target: { value: "ceo@empresa.com.br" } });
    
    const emailForm = screen.getByLabelText("Passo 3: E-mail Corporativo");
    
    // Spy on Event.prototype.preventDefault to verify it is called
    const preventDefaultSpy = jest.spyOn(window.Event.prototype, "preventDefault");

    // Submit the form
    fireEvent.submit(emailForm);
    
    // Verify preventDefault was called on the event
    expect(preventDefaultSpy).toHaveBeenCalled();
    preventDefaultSpy.mockRestore();
    
    // Verify handlers called with expected mapped values
    expect(mockOnSubmit).toHaveBeenCalledWith({
      cnpj: "12.345.678/0001-95",
      faturamento: "1.000.000,00",
      email: "ceo@empresa.com.br",
    });
    
    expect(mockOnRegister).toHaveBeenCalledWith(
      "growth",
      "12.345.678/0001-95",
      "1.000.000,00",
      "ceo@empresa.com.br"
    );

    // Verify transition to results screen
    const resultsContainer = await screen.findByLabelText("Resultados da simulação", {}, { timeout: 1500 });
    expect(resultsContainer).toBeInTheDocument();
    expect(screen.getByText("Simples Nacional")).toBeInTheDocument();
  });
});
