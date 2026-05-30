import React from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import TaxPage from "../page";

// Mock apiRequest
jest.mock("@/lib/api", () => ({
  apiRequest: jest.fn(),
}));

const { apiRequest } = require("@/lib/api");

describe("TaxPage - Motor Fiscal Page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("submits form successfully and displays results", async () => {
    // Mock simulation API success response
    (apiRequest as jest.Mock).mockResolvedValueOnce({
      bestRegime: { key: "simples", name: "Simples Nacional" },
      regimes: [
        {
          key: "simples",
          name: "Simples Nacional",
          eligible: true,
          annualTax: 50000,
          monthlyTax: 4166.67,
          effectiveRate: 0.10,
          savingsComparedToWorst: { monthly: 1000 },
        },
      ],
    });

    render(<TaxPage />);

    // Check empty state is rendered initially
    expect(screen.getByTestId("empty-state")).toBeInTheDocument();

    // Fill form fields
    const faturamentoInput = screen.getByLabelText("Faturamento anual (R$)");
    const margemInput = screen.getByLabelText("Margem estimada (%)");

    fireEvent.change(faturamentoInput, { target: { value: "100000000" } }); // R$ 1.000.000,00
    fireEvent.change(margemInput, { target: { value: "1500" } }); // 15,00%

    // Submit form
    const submitBtn = screen.getByRole("button", { name: /comparar/i });
    fireEvent.click(submitBtn);

    // Verify loading state is triggered
    expect(screen.getByRole("button", { name: /processando/i })).toBeInTheDocument();
    expect(submitBtn).toBeDisabled();

    // Wait for results to render
    const results = await screen.findByTestId("simulation-results");
    expect(within(results).getByText("Simples Nacional")).toBeInTheDocument();
    expect(screen.queryByTestId("empty-state")).not.toBeInTheDocument();
  });

  test("handles API errors gracefully", async () => {
    // Mock API error
    (apiRequest as jest.Mock).mockRejectedValueOnce(new Error("Erro interno do servidor."));

    render(<TaxPage />);

    // Fill form and submit
    const faturamentoInput = screen.getByLabelText("Faturamento anual (R$)");
    const margemInput = screen.getByLabelText("Margem estimada (%)");

    fireEvent.change(faturamentoInput, { target: { value: "100000000" } });
    fireEvent.change(margemInput, { target: { value: "1500" } });

    const submitBtn = screen.getByRole("button", { name: /comparar/i });
    fireEvent.click(submitBtn);

    // Wait for error message to appear
    await screen.findByRole("alert");
    expect(screen.getByText("Erro interno do servidor.")).toBeInTheDocument();

    // Verify loading state is removed and button is active again
    expect(screen.getByRole("button", { name: /comparar/i })).not.toBeDisabled();
  });

  test("prevents duplicate submissions while calculating", async () => {
    let resolveApiPromise: any;
    const apiPromise = new Promise((resolve) => {
      resolveApiPromise = resolve;
    });

    (apiRequest as jest.Mock).mockReturnValue(apiPromise);

    render(<TaxPage />);

    // Fill form and submit
    const faturamentoInput = screen.getByLabelText("Faturamento anual (R$)");
    const margemInput = screen.getByLabelText("Margem estimada (%)");

    fireEvent.change(faturamentoInput, { target: { value: "100000000" } });
    fireEvent.change(margemInput, { target: { value: "1500" } });

    const submitBtn = screen.getByRole("button", { name: /comparar/i });
    
    // Trigger double click
    fireEvent.click(submitBtn);
    fireEvent.click(submitBtn);

    // Verify apiRequest was called only once
    expect(apiRequest).toHaveBeenCalledTimes(1);

    // Resolve API call
    resolveApiPromise({
      bestRegime: { key: "simples", name: "Simples Nacional" },
      regimes: [],
    });
  });
});
