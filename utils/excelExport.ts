import * as XLSX from 'xlsx';
import { BudgetItem, HRItem, TaxRates, DEFAULT_TAX_RATES } from '../types';

export const generateSpreadsheet = (items: BudgetItem[], hrItems: HRItem[], title: string, taxRates: TaxRates = DEFAULT_TAX_RATES) => {
  const workbook = XLSX.utils.book_new();

  // ============================================================================================
  // SHEET 1: BENS E SERVIÇOS (QDD)
  // ============================================================================================
  const groupedItems: Record<string, BudgetItem[]> = {};
  items.forEach(item => {
    const key = `${item.rubricCode} - ${item.rubricDesc}`;
    if (!groupedItems[key]) groupedItems[key] = [];
    groupedItems[key].push(item);
  });

  const rows: any[] = [];
  rows.push(['QDD - QUADRO DE DETALHAMENTO DE DESPESAS']);
  rows.push([]);

  // Loop through rubrics
  Object.keys(groupedItems).sort().forEach(rubricTitle => {
    rows.push([rubricTitle.toUpperCase()]);
    // REMOVED 'Tipo' and 'Prioridade'
    rows.push(['Item', 'Valor Unit.', 'Qtd', 'Freq. (Meses)', 'TOTAL ANUAL']);
    
    let startRow = rows.length + 1; 
    
    groupedItems[rubricTitle].forEach(item => {
      const r = rows.length + 1; // Current row 1-based
      
      rows.push([
        item.name,
        { v: item.unitValue, t: 'n', z: '"R$ "#,##0.00' },
        { v: item.quantity, t: 'n' },
        { v: item.frequency, t: 'n' },
        { f: `B${r}*C${r}*D${r}`, t: 'n', z: '"R$ "#,##0.00' } // Formula: Unit * Qty * Freq
      ]);
    });
    
    const endRow = rows.length;
    // Subtotal
    rows.push([
      `TOTAL ${rubricTitle}`, 
      '', '', '', 
      { f: `SUM(E${startRow}:E${endRow})`, t: 'n', z: '"R$ "#,##0.00' }
    ]);
    rows.push([]); // Spacer
  });

  const goodsWorksheet = XLSX.utils.aoa_to_sheet(rows);
  goodsWorksheet['!cols'] = [{wch:40}, {wch:15}, {wch:10}, {wch:15}, {wch:20}];
  XLSX.utils.book_append_sheet(workbook, goodsWorksheet, "Bens e Serviços");


  // ============================================================================================
  // SHEET 2: RECURSOS HUMANOS (RH) - FULLY FORMULA DRIVEN
  // ============================================================================================
  if (hrItems.length > 0) {
    const hrRows: any[] = [];
    hrRows.push(['PLANILHA DE CUSTOS DE PESSOAL (RH)']);
    hrRows.push([]);
    
    // Exact Columns requested + "Salário Unitário" to make formulas work
    const headers = [
      'Cargo/Função',        // A
      'Qtd',                 // B
      'Escolaridade',        // C
      'C.H. Semanal',        // D
      'Meses',               // E
      'Salário Unitário',    // F (NEW)
      'Salário Base Total',  // G (Formula)
      'FGTS (8%)',           // H
      'INSS Patronal (20%)', // I
      'PIS (1%)',            // J
      'Prov. 1/3 Férias',    // K
      'Prov. FGTS 1/3',      // L
      'Prov. INSS 1/3',      // M
      'Prov. 13º Salário',   // N
      'Prov. FGTS 13º',      // O
      'Prov. INSS 13º',      // P
      'Bem Estar Social',    // Q
      'Prov. Multa FGTS 40%',// R
      'Total Mês',           // S
      'Total Anual'          // T
    ];
    hrRows.push(headers);

    const dataStartRow = 4; // Data starts at Excel Row 4 (Index 3 in array is header, pushed next)

    hrItems.forEach((hr) => {
        const r = hrRows.length + 1; // Current Excel Row Index (1-based)

        // Rates Constants
        const R_FGTS = taxRates.FGTS;
        const R_INSS = taxRates.INSS_PATRONAL;
        const R_PIS = taxRates.PIS;
        const R_INSS_PROV = taxRates.PROVISION_INSS_RATE;
        const R_MULTA = taxRates.MULTA_FGTS;
        
        // Benefits Unit Value (if any)
        const benefitUnit = hr.benefits || 0;

        hrRows.push([
            hr.role,                                                // A
            hr.quantity,                                            // B
            hr.education,                                           // C
            hr.weeklyHours,                                         // D
            hr.months,                                              // E
            { v: hr.grossSalary, t: 'n', z: '"R$ "#,##0.00' },      // F - Unit Salary
            
            // G - Base Total: Unit * Qty
            { f: `F${r}*B${r}`, t: 'n', z: '"R$ "#,##0.00' },       
            
            // H - FGTS: Base * Rate
            { f: `G${r}*${R_FGTS}`, t: 'n', z: '"R$ "#,##0.00' },   
            
            // I - INSS: Base * Rate
            { f: `G${r}*${R_INSS}`, t: 'n', z: '"R$ "#,##0.00' },   
            
            // J - PIS: (Base + ProvFerias + Prov13) * Rate
            { f: `(G${r}+K${r}+N${r})*${R_PIS}`, t: 'n', z: '"R$ "#,##0.00' }, 
            
            // K - Prov 1/3 Férias: Base * Rate (1/36)
            { f: `G${r}*${taxRates.PROVISION_1_3_FERIAS}`, t: 'n', z: '"R$ "#,##0.00' },
            
            // L - Prov FGTS 1/3: K * Rate
            { f: `K${r}*${R_FGTS}`, t: 'n', z: '"R$ "#,##0.00' },
            
            // M - Prov INSS 1/3: K * Rate
            { f: `K${r}*${R_INSS_PROV}`, t: 'n', z: '"R$ "#,##0.00' },
            
            // N - Prov 13º: Base * Rate (1/12)
            { f: `G${r}*${taxRates.PROVISION_13}`, t: 'n', z: '"R$ "#,##0.00' },
            
            // O - Prov FGTS 13º: N * Rate
            { f: `N${r}*${R_FGTS}`, t: 'n', z: '"R$ "#,##0.00' },
            
            // P - Prov INSS 13º: N * Rate
            { f: `N${r}*${R_INSS_PROV}`, t: 'n', z: '"R$ "#,##0.00' },
            
            // Q - Bem Estar: Qty * Unit Benefit (inline value to ensure portability)
            { f: `B${r}*${benefitUnit}`, t: 'n', z: '"R$ "#,##0.00' },

            // R - Multa FGTS 40%: (FGTS Mensal + FGTS Ferias + FGTS 13) * Rate
            // H + L + O
            { f: `(H${r}+L${r}+O${r})*${R_MULTA}`, t: 'n', z: '"R$ "#,##0.00' },

            // S - Total Mês: Sum(G..R)
            { f: `SUM(G${r}:R${r})`, t: 'n', z: '"R$ "#,##0.00', s: { font: { bold: true } } },

            // T - Total Anual: Total Mês * Meses (E)
            { f: `S${r}*E${r}`, t: 'n', z: '"R$ "#,##0.00', s: { font: { bold: true, color: { rgb: "0000FF" } } } }
        ]);
    });

    // Total Row
    const totalRowIndex = hrRows.length + 1;
    const lastDataRow = hrRows.length;
    
    // Construct totals row
    // A-E Empty
    const totalRow: any[] = ['TOTAIS GERAIS', '', '', '', '', ''];
    
    // F (Unit Salary) - No Sum
    // G (Base Total) to T (Total Anual) - Sum
    const columnsToSum = ['G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T'];
    
    columnsToSum.forEach(colLetter => {
        totalRow.push({ 
            f: `SUM(${colLetter}${dataStartRow}:${colLetter}${lastDataRow})`, 
            t: 'n', 
            z: '"R$ "#,##0.00',
            s: { font: { bold: true } }
        });
    });
    
    hrRows.push(totalRow);

    const hrWorksheet = XLSX.utils.aoa_to_sheet(hrRows);
    
    // Column Widths
    hrWorksheet['!cols'] = [
        {wch: 25}, // A Cargo
        {wch: 5},  // B Qty
        {wch: 15}, // C Edu
        {wch: 10}, // D CH
        {wch: 5},  // E Meses
        {wch: 15}, // F Unit
        {wch: 15}, // G Base
        {wch: 12}, // H FGTS
        {wch: 12}, // I INSS
        {wch: 10}, // J PIS
        {wch: 12}, // K Prov Fer
        {wch: 12}, // L Prov FGTS F
        {wch: 12}, // M Prov INSS F
        {wch: 12}, // N Prov 13
        {wch: 12}, // O Prov FGTS 13
        {wch: 12}, // P Prov INSS 13
        {wch: 15}, // Q Bem Estar
        {wch: 15}, // R Multa
        {wch: 18}, // S Total Mes
        {wch: 18}  // T Total Anual
    ];

    XLSX.utils.book_append_sheet(workbook, hrWorksheet, "Recursos Humanos");
  }

  XLSX.writeFile(workbook, `${title.replace(/\s+/g, '_')}_SCFV.xlsx`);
};