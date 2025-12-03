import * as XLSX from 'xlsx';

export const parseExcelFile = async (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = e.target?.result;
                const workbook = XLSX.read(data, { type: 'binary' });
                
                // Aggregate data from all sheets
                let allRows: any[] = [];
                workbook.SheetNames.forEach(sheetName => {
                    const sheet = workbook.Sheets[sheetName];
                    const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }); // Array of arrays
                    // Add a context column
                    const jsonWithContext = json.map((row: any) => [...(Array.isArray(row) ? row : []), `Sheet: ${sheetName}`]);
                    allRows = [...allRows, ...jsonWithContext];
                });

                resolve(allRows);
            } catch (error) {
                reject(error);
            }
        };
        reader.onerror = (error) => reject(error);
        reader.readAsBinaryString(file);
    });
};