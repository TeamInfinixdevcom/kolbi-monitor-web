import "@testing-library/jest-dom";
import React from "react";
import { render, screen } from "@testing-library/react";
import Inventory from "./Inventory";

// Mock Firestore
jest.mock("../firebase", () => ({
  db: {},
}));
jest.mock("firebase/firestore", () => ({
  collection: jest.fn(),
  onSnapshot: (ref, cb) => {
    cb({
      docs: [
        {
          id: "1",
          data: () => ({ imei: "123456789012345", marca: "Samsung", terminal: "S24", estado: "vendido" }),
        },
        {
          id: "2",
          data: () => ({ imei: "987654321098765", marca: "Apple", terminal: "iPhone", estado: "bloqueado" }),
        },
      ],
    });
    return () => {};
  },
  addDoc: jest.fn(),
}));

describe("Inventory", () => {
  it("muestra IMEIs y pinta los vendidos en lila", async () => {
    render(<Inventory />);
    expect(await screen.findByText("123456789012345")).toBeInTheDocument();
    expect(await screen.findByText("987654321098765")).toBeInTheDocument();
    const vendidoCell = screen.getByText("vendido");
  expect(vendidoCell).toHaveStyle("color: rgb(128, 0, 128)");
    expect(vendidoCell).toHaveStyle("font-weight: bold");
    const bloqueadoCell = screen.getByText("bloqueado");
    expect(bloqueadoCell).not.toHaveStyle("color: purple");
  });
});
