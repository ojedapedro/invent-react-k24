/* Inventory Control Web App - Simple Frontend (single-file React)
 - Features: upload/download Excel, scan input, edit/delete, incidents PDF, history in localStorage
 - Dependencies: xlsx, file-saver, jspdf, lucide-react
*/
import React, { useEffect, useState, useRef } from "react";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import { FileDown, Trash2, Edit2, AlertTriangle, Check } from "lucide-react";

export default function App() {
  const [theoretical, setTheoretical] = useState([]);
  const [realInventory, setRealInventory] = useState([]);
  const [history, setHistory] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [scanInput, setScanInput] = useState("");
  const [alert, setAlert] = useState(null);
  const scanRef = useRef(null);

  useEffect(() => {
    const t = localStorage.getItem("inv_theoretical");
    const r = localStorage.getItem("inv_real");
    const h = localStorage.getItem("inv_history");
    const i = localStorage.getItem("inv_incidents");
    if (t) setTheoretical(JSON.parse(t));
    if (r) setRealInventory(JSON.parse(r));
    if (h) setHistory(JSON.parse(h));
    if (i) setIncidents(JSON.parse(i));
  }, []);

  useEffect(() => { localStorage.setItem("inv_theoretical", JSON.stringify(theoretical)); }, [theoretical]);
  useEffect(() => { localStorage.setItem("inv_real", JSON.stringify(realInventory)); }, [realInventory]);
  useEffect(() => { localStorage.setItem("inv_history", JSON.stringify(history)); }, [history]);
  useEffect(() => { localStorage.setItem("inv_incidents", JSON.stringify(incidents)); }, [incidents]);

  function showTempAlert(msg, type = "info") {
    setAlert({ msg, type });
    setTimeout(() => setAlert(null), 3500);
  }

  function downloadTheoretical() {
    const ws = XLSX.utils.json_to_sheet(theoretical.length ? theoretical : [{ code: "1234567890123", name: "Example item", qty: 10 }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inventory");
    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(new Blob([wbout], { type: "application/octet-stream" }), "inventario_teorico.xlsx");
  }

  function handleExcelUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target.result;
      const wb = XLSX.read(bstr, { type: "binary" });
      const first = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(first, { defval: "" });
      const normalized = data.map((row) => ({
        code: String(row.code ?? row.Codigo ?? row.CODIGO ?? row.barcode ?? row.Barcode ?? row.BARCODE ?? "").trim(),
        name: row.name ?? row.Name ?? row.NOMBRE ?? row.nombre ?? "",
        qty: Number(row.qty ?? row.Qty ?? row.CANT ?? row.cant ?? row.cantidad ?? 0) || 0,
      }));
      setTheoretical(normalized);
      showTempAlert("Inventario teórico cargado", "success");
    };
    reader.readAsBinaryString(file);
    e.target.value = null;
  }

  useEffect(() => {
    function onKey(e) {
      if (document.activeElement && document.activeElement.tagName === "INPUT") return;
      if (e.key === "Enter") {
        if (scanInput.trim()) {
          processScannedCode(scanInput.trim());
        }
        setScanInput("");
      } else if (e.key.length === 1) {
        setScanInput((s) => s + e.key);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [scanInput, theoretical, realInventory]);

  function processScannedCode(code) {
    const foundTheoretical = theoretical.find((t) => t.code === code);
    const foundRealIdx = realInventory.findIndex((r) => r.code === code);

    if (!foundTheoretical && foundRealIdx === -1) {
      const incident = { id: Date.now(), code, type: "not_found", time: new Date().toISOString() };
      setIncidents((s) => [incident, ...s]);
      setHistory((h) => [{ action: "scan_not_found", code, time: new Date().toISOString() }, ...h]);
      showTempAlert(`Código ${code} no encontrado — incidente registrado`, "error");
      return;
    }

    if (foundRealIdx !== -1) {
      const copy = [...realInventory];
      copy[foundRealIdx] = { ...copy[foundRealIdx], qty: Number(copy[foundRealIdx].qty || 0) + 1 };
      setRealInventory(copy);
      setHistory((h) => [{ action: "increment", code, time: new Date().toISOString() }, ...h]);
      showTempAlert(`Registro actualizado: ${code}`, "success");
      return;
    }

    if (foundTheoretical) {
      const newRec = { code, name: foundTheoretical.name || "", qty: 1, fromTheoretical: true };
      setRealInventory((r) => [newRec, ...r]);
      setHistory((h) => [{ action: "add_from_scan", code, time: new Date().toISOString(), name: newRec.name }, ...h]);
      showTempAlert(`Artículo agregado al inventario real: ${code}`, "success");
      return;
    }
  }

  function addManualRecord(rec) {
    setRealInventory((r) => [rec, ...r]);
    setHistory((h) => [{ action: "manual_add", rec, time: new Date().toISOString() }, ...h]);
  }

  function updateRecord(code, updates) {
    setRealInventory((r) => r.map((it) => (it.code === code ? { ...it, ...updates } : it)));
    setHistory((h) => [{ action: "update", code, updates, time: new Date().toISOString() }, ...h]);
  }

  function deleteRecord(code) {
    setRealInventory((r) => r.filter((it) => it.code !== code));
    setHistory((h) => [{ action: "delete", code, time: new Date().toISOString() }, ...h]);
  }

  function computeIncidents() {
    const mapTheo = new Map(theoretical.map((t) => [t.code, t]));
    const mapReal = new Map(realInventory.map((r) => [r.code, r]));
    const results = [];
    for (const t of theoretical) {
      const r = mapReal.get(t.code);
      if (!r) results.push({ code: t.code, name: t.name, expected: t.qty, actual: 0, type: "missing" });
      else if (Number(r.qty) !== Number(t.qty)) results.push({ code: t.code, name: t.name, expected: t.qty, actual: r.qty, type: "mismatch" });
    }
    for (const r of realInventory) {
      if (!mapTheo.has(r.code)) results.push({ code: r.code, name: r.name, expected: 0, actual: r.qty, type: "unexpected" });
    }
    setIncidents(results);
    showTempAlert("Incidentes calculados", "info");
  }

  function downloadIncidentsPdf() {
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text("Reporte de Incidencias - Inventario", 14, 20);
    let y = 30;
    incidents.forEach((inc, idx) => {
      const line = `${idx + 1}. [${inc.type}] ${inc.code} — esperado: ${inc.expected ?? "-"} — actual: ${inc.actual ?? "-"}`;
      doc.text(line, 14, y);
      y += 8;
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
    });
    doc.save("reporte_incidentes.pdf");
  }

  function exportHistory() {
    const blob = new Blob([JSON.stringify(history, null, 2)], { type: "application/json" });
    saveAs(blob, "inventario_historial.json");
  }

  function renderAlert() {
    if (!alert) return null;
    const cls = "p-2 rounded shadow text-sm";
    return (
      <div className={`fixed top-4 right-4 bg-white border ${alert.type === "error" ? "border-red-300" : "border-green-300"} ${cls}`}>
        {alert.msg}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {renderAlert()}
      <header className="max-w-6xl mx-auto mb-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Control de Inventario</h1>
        </div>
      </header>

      <main className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
        <section className="col-span-1 md:col-span-1 bg-white p-4 rounded shadow">
          <h2 className="font-semibold mb-2">Archivo teórico</h2>
          <div className="flex gap-2 mb-2">
            <input type="file" accept=".xlsx,.xls" onChange={handleExcelUpload} />
            <button className="px-3 py-1 rounded bg-blue-600 text-white" onClick={downloadTheoretical}>
              <FileDown size={16} className="inline" /> Descargar Excel
            </button>
          </div>
          <div className="text-xs text-gray-600 mb-2">Filas cargadas: {theoretical.length}</div>
          <div className="overflow-auto max-h-48">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500">
                  <th>Codigo</th>
                  <th>Nombre</th>
                  <th>Qty</th>
                </tr>
              </thead>
              <tbody>
                {theoretical.slice(0, 20).map((t) => (
                  <tr key={t.code} className="border-t">
                    <td>{t.code}</td>
                    <td>{t.name}</td>
                    <td>{t.qty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="col-span-1 md:col-span-1 bg-white p-4 rounded shadow">
          <h2 className="font-semibold mb-2">Escaneo / Toma</h2>
          <div className="mb-2">
            <label className="block text-xs mb-1">Input de Escaneo (enfocado o usa lector físico)</label>
            <input
              ref={scanRef}
              value={scanInput}
              onChange={(e) => setScanInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  processScannedCode(scanInput.trim());
                  setScanInput("");
                }
              }}
              className="w-full border p-2 rounded"
              placeholder="Escanea un código o escribe y presiona Enter"
            />
          </div>

          <div className="mb-2">
            <button className="px-3 py-1 rounded bg-green-600 text-white mr-2" onClick={computeIncidents}>
              <Check size={14} className="inline" /> Comparar con teórico
            </button>
            <button className="px-3 py-1 rounded bg-yellow-500 text-white mr-2" onClick={() => exportHistory()}>
              Exportar historial
            </button>
            <button className="px-3 py-1 rounded bg-red-500 text-white" onClick={() => { setRealInventory([]); setHistory((h) => [{ action: "clear_real", time: new Date().toISOString() }, ...h]); }}>
              Limpiar toma
            </button>
          </div>

          <div className="overflow-auto max-h-48">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500">
                  <th>Codigo</th>
                  <th>Nombre</th>
                  <th>Qty</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {realInventory.map((r) => (
                  <tr key={r.code} className="border-t">
                    <td>{r.code}</td>
                    <td>{r.name}</td>
                    <td>{r.qty}</td>
                    <td className="flex gap-2">
                      <button className="p-1 rounded bg-gray-200" onClick={() => {
                        const newName = prompt("Nuevo nombre:", r.name);
                        if (newName !== null) updateRecord(r.code, { name: newName });
                      }}>
                        <Edit2 size={14} />
                      </button>
                      <button className="p-1 rounded bg-red-200" onClick={() => { if (window.confirm("Eliminar registro?")) deleteRecord(r.code); }}>
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-2 text-xs text-gray-600">Registros contados: {realInventory.length}</div>
        </section>

        <section className="col-span-1 md:col-span-1 bg-white p-4 rounded shadow">
          <h2 className="font-semibold mb-2">Incidentes & Historial</h2>
          <div className="flex gap-2 mb-2">
            <button className="px-3 py-1 rounded bg-indigo-600 text-white" onClick={downloadIncidentsPdf}>
              <FileDown size={14} /> Descargar reporte (PDF)
            </button>
            <button className="px-3 py-1 rounded bg-gray-200" onClick={() => { setIncidents([]); showTempAlert("Incidentes borrados", "info"); }}>
              Limpiar incidentes
            </button>
          </div>

          <div className="overflow-auto max-h-40 mb-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500">
                  <th>Tipo</th>
                  <th>Codigo</th>
                  <th>Exp/Act</th>
                </tr>
              </thead>
              <tbody>
                {incidents.slice(0, 50).map((inc, idx) => (
                  <tr key={idx} className="border-t">
                    <td className="capitalize">{inc.type}</td>
                    <td>{inc.code}</td>
                    <td>{inc.expected ?? "-"} / {inc.actual ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 className="font-medium">Historial reciente</h3>
          <div className="overflow-auto max-h-36 mt-2 text-xs text-gray-700">
            <ul>
              {history.slice(0, 50).map((h, idx) => (
                <li key={idx} className="border-t py-1">[{new Date(h.time).toLocaleString()}] {h.action} — {h.code ?? JSON.stringify(h.rec ?? h.updates ?? "")}</li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      <footer className="max-w-6xl mx-auto mt-6 text-sm text-gray-500">Tip: muchos lectores de código actúan como teclado — escanean y envían Enter automáticamente.</footer>
    </div>
  );
}
