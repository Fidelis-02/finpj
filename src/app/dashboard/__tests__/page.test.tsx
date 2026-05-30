import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import DashboardOverview from "../page";

// Mock apiRequest
jest.mock("@/lib/api", () => ({
  apiRequest: jest.fn(),
}));

// Mock useAuth
jest.mock("@/contexts/auth-context", () => ({
  useAuth: () => ({
    activeCompany: {
      _id: "company-123",
      nome: "Empresa Teste",
      cnpj: "12.345.678/0001-95",
      regime: "simples",
      faturamento: 1000000,
      margem: 0.15,
    },
    user: {
      email: "test@example.com",
    },
    isAuthenticated: true,
  }),
}));

// Mock ValuationCard
jest.mock("@/components/dashboard/valuation-card", () => ({
  ValuationCard: () => <div data-testid="valuation-card">Valuation Card Mock</div>,
}));

// Mock Recharts ResponsiveContainer to bypass JSDOM dimension checks
jest.mock("recharts", () => {
  const OriginalModule = jest.requireActual("recharts");
  return {
    ...OriginalModule,
    ResponsiveContainer: ({ children }: any) => (
      <div style={{ width: "800px", height: "400px" }} data-testid="responsive-container-mock">
        {children}
      </div>
    ),
  };
});

const { apiRequest } = require("@/lib/api");

describe("DashboardOverview Page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("renders KPIs, Chart and smart insights banner when taxSavings > 0", async () => {
    // Mock API response with positive taxSavings
    (apiRequest as jest.Mock).mockResolvedValueOnce({
      kpis: {
        monthlyRevenue: 150000,
        monthlyTaxes: 12000,
        profitMargin: 0.22,
        taxSavings: 25000,
        alerts: 2,
      },
    });

    render(<DashboardOverview />);

    // Verify loading skeleton resolves to values
    await waitFor(() => {
      expect(screen.getByTestId("kpi-value-monthlyRevenue")).toHaveTextContent("R$ 150.000,00");
    });

    expect(screen.getByTestId("kpi-value-monthlyTaxes")).toHaveTextContent("R$ 12.000,00");
    expect(screen.getByTestId("kpi-value-profitMargin")).toHaveTextContent("22.0%");
    expect(screen.getByTestId("kpi-value-taxSavings")).toHaveTextContent("R$ 25.000,00");
    expect(screen.getByTestId("kpi-value-alerts")).toHaveTextContent("2");

    // Verify Smart Insights Banner is visible with BRL formatted savings
    const banner = screen.getByTestId("smart-insights-banner");
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveTextContent("R$ 25.000,00");

    // Verify Recharts is rendered
    expect(screen.getByTestId("dashboard-chart")).toBeInTheDocument();
  });

  test("hides smart insights banner when taxSavings = 0", async () => {
    // Mock API response with zero taxSavings
    (apiRequest as jest.Mock).mockResolvedValueOnce({
      kpis: {
        monthlyRevenue: 150000,
        monthlyTaxes: 12000,
        profitMargin: 0.22,
        taxSavings: 0,
        alerts: 2,
      },
    });

    render(<DashboardOverview />);

    // Verify loading resolves to values
    await waitFor(() => {
      expect(screen.getByTestId("kpi-value-monthlyRevenue")).toHaveTextContent("R$ 150.000,00");
    });

    // Verify Smart Insights Banner is not rendered
    expect(screen.queryByTestId("smart-insights-banner")).not.toBeInTheDocument();
  });
});
