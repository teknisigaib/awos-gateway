const express = require('express');
const axios = require('axios');

const app = express();
const PORT = 3006;

// Konfigurasi Target AWOS
const AWOS_IP = '192.168.5.2';
const baseUrl = `http://${AWOS_IP}/awilogs.php?html=true&type=oneminute&filename=101OneMinute.`;

let latestAwosData = null;

function getTodayString() {
    const d = new Date();
    return d.getFullYear() +
           String(d.getMonth() + 1).padStart(2, '0') +
           String(d.getDate()).padStart(2, '0');
}

// Fungsi pembantu untuk konversi nilai (membagi 10 jika bukan string khusus seperti '///' atau 'M')
function parseDecimal(val) {
    if (val === '///' || val === 'M' || isNaN(val)) return val;
    return (parseFloat(val) / 10);
}

// Fungsi pembantu untuk nilai utuh (tanpa desimal)
function parseIntVal(val) {
    if (val === '///' || val === 'M' || isNaN(val)) return val;
    return parseInt(val, 10);
}

async function fetchAwosData() {
    try {
        const targetUrl = `${baseUrl}${getTodayString()}.dat`;
        const response = await axios.get(targetUrl);
        
        const lines = response.data.split('\n');
        const dataLines = lines.filter(line => line.trim().startsWith('101 '));
        
        if (dataLines.length === 0) return;

        const latestLine = dataLines[dataLines.length - 1];
        const parts = latestLine.trim().split(/\s+/);

        const hourUTC = parseInt(parts[2], 10);
        const minuteUTC = parts[3];
        const hourWITA = (hourUTC + 8) % 24;
        
        const time_utc = `${String(hourUTC).padStart(2, '0')}:${minuteUTC}`;
        const time_wita = `${String(hourWITA).padStart(2, '0')}:${minuteUTC}`;
        const ltxData = parts.slice(51).join(' '); 

        latestAwosData = {
            site: "WALS",
            upt: "Stasiun meteorologi Kelas II APT Pranoto Samarinda",
            date: parts[1],
            time_utc: time_utc,
            time_wita: time_wita,
            data: {
                "04": {
                    WS: { value: parseIntVal(parts[4]), unit: "kt" },
                    WD: { value: parseIntVal(parts[5]), unit: "deg" },
                    WGS: { value: parseIntVal(parts[6]), unit: "kt" },
                    WGD: { value: parseIntVal(parts[7]), unit: "deg" },
                    TEMP: { value: parseDecimal(parts[16]), unit: "degC" },
                    DEWP: { value: parseDecimal(parts[17]), unit: "degC" },
                    RH: { value: parseIntVal(parts[18]), unit: "%" },
                    QNH: { value: parseDecimal(parts[25]), unit: "hPa" },
                    DA: { value: parseIntVal(parts[28]), unit: "ft" },
                    ALS: { value: parseIntVal(parts[31]), unit: "cd" },
                    VIS: { value: parseIntVal(parts[33]), unit: "m" },
                    RVR: { value: parseIntVal(parts[34]), unit: "m" },
                    RLS_Edg: { value: parts[35], unit: "" },
                    RLS_Ctr: { value: parts[36], unit: "" },
                    RLS_Man: { value: parts[37], unit: "" },
                    LR1: { value: parseIntVal(parts[43]), unit: "100ft" },
                    SKY: { value: parts[45], unit: "" },
                    RA: { value: parseIntVal(parts[47]), unit: "mm" }
                },
                "M": {
                    WS: { value: parseIntVal(parts[8]), unit: "kt" },
                    WD: { value: parseIntVal(parts[9]), unit: "deg" },
                    WGS: { value: parseIntVal(parts[10]), unit: "kt" },
                    WGD: { value: parseIntVal(parts[11]), unit: "deg" },
                    TEMP: { value: parseDecimal(parts[19]), unit: "degC" },
                    DEWP: { value: parseDecimal(parts[20]), unit: "degC" },
                    RH: { value: parseIntVal(parts[21]), unit: "%" },
                    QNH: { value: parseDecimal(parts[26]), unit: "hPa" },
                    DA: { value: parseIntVal(parts[29]), unit: "ft" },
                    D_N: { value: parts[32], unit: "" },
                    RA: { value: parseIntVal(parts[48]), unit: "mm" },
                    SOL: { value: parseIntVal(parts[50]), unit: "W/m2" },
                    LTX: { value: ltxData, unit: "" }
                },
                "22": {
                    WS: { value: parseIntVal(parts[12]), unit: "kt" },
                    WD: { value: parseIntVal(parts[13]), unit: "deg" },
                    WGS: { value: parseIntVal(parts[14]), unit: "kt" },
                    WGD: { value: parseIntVal(parts[15]), unit: "deg" },
                    TEMP: { value: parseDecimal(parts[22]), unit: "degC" },
                    DEWP: { value: parseDecimal(parts[23]), unit: "degC" },
                    RH: { value: parseIntVal(parts[24]), unit: "%" },
                    QNH: { value: parseDecimal(parts[27]), unit: "hPa" },
                    DA: { value: parseIntVal(parts[30]), unit: "ft" },
                    VIS: { value: parseIntVal(parts[38]), unit: "m" },
                    RVR: { value: parseIntVal(parts[39]), unit: "m" },
                    RLS_Edg: { value: parts[40], unit: "" },
                    RLS_Ctr: { value: parts[41], unit: "" },
                    RLS_Man: { value: parts[42], unit: "" },
                    LR1: { value: parseIntVal(parts[44]), unit: "100ft" },
                    SKY: { value: parts[46], unit: "" },
                    RA: { value: parseIntVal(parts[49]), unit: "mm" }
                }
            }
        };

        console.log(`[${new Date().toLocaleTimeString()}] Berhasil update data UTC ${time_utc} / WITA ${time_wita}`);

    } catch (error) {
        console.error(`[ERROR] Gagal menarik data: ${error.message}`);
    }
}

fetchAwosData();
setInterval(fetchAwosData, 60000);

app.get('/api/awos/latest', (req, res) => {
    if (!latestAwosData) {
        return res.status(503).json({ 
            status: "error", 
            message: "Data sedang ditarik dari server AWOS, coba beberapa detik lagi." 
        });
    }
    
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    res.json({
        status: "success",
        data: latestAwosData
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Gateway API AWOS berjalan di http://localhost:${PORT}`);
});