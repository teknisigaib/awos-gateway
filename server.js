const express = require('express');
const axios = require('axios');

const app = express();
const PORT = 3006;

// Konfigurasi Target AWOS
const AWOS_IP = '192.168.5.3';
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

// ... (bagian awal server.js tetap sama)

async function fetchAwosData() {
    try {
        const targetUrl = `${baseUrl}${getTodayString()}.dat`;
        const response = await axios.get(targetUrl);
        
        const lines = response.data.split('\n');
        const dataLines = lines.filter(line => line.trim().startsWith('101 '));
        
        if (dataLines.length === 0) return;

        const latestLine = dataLines[dataLines.length - 1];

        // --- FIXED-WIDTH PARSING MENGGUNAKAN REFERENSI POSISI 0-BASED ---
        const getVal = (start, end) => {
            // Pastikan baris cukup panjang untuk dipotong, jika tidak kembalikan string kosong
            if (latestLine.length < start) return "";
            return latestLine.substring(start, end).trim();
        };

        // 1. Identitas waktu dan stasiun
        const stn   = getVal(0, 4);
        const date  = getVal(4, 13);
        const hhUTC = getVal(13, 16);
        const mmUTC = getVal(16, 19);

        const hourUTC = parseInt(hhUTC, 10);
        const hourWITA = (hourUTC + 8) % 24;
        const time_utc = `${String(hourUTC).padStart(2, '0')}:${mmUTC}`;
        const time_wita = `${String(hourWITA).padStart(2, '0')}:${mmUTC}`;

        // 2. Data Angin (WIND)
        const ws04  = getVal(19, 24);
        const wd04  = getVal(24, 29);
        const wgs04 = getVal(29, 34);
        const wgd04 = getVal(34, 39);

        const wsM   = getVal(39, 44);
        const wdM   = getVal(44, 49);
        const wgsM  = getVal(49, 54);
        const wgdM  = getVal(54, 59);

        const ws22  = getVal(59, 64);
        const wd22  = getVal(64, 69);
        const wgs22 = getVal(69, 74);
        const wgd22 = getVal(74, 79);

        // 3. Suhu dan Kelembapan
        const temp04 = getVal(79, 84);
        const dewp04 = getVal(84, 89);
        const rh04   = getVal(89, 94);

        const tempM  = getVal(94, 99);
        const dewpM  = getVal(99, 104);
        const rhM    = getVal(104, 109);

        const temp22 = getVal(109, 114);
        const dewp22 = getVal(114, 119);
        const rh22   = getVal(119, 124);

        // 4. Tekanan Udara (QNH)
        const qnh04  = getVal(124, 130);
        const qnhM   = getVal(130, 136);
        const qnh22  = getVal(136, 142);

        // 5. Density Altitude (DA)
        const da04   = getVal(142, 148);
        const daM    = getVal(148, 154);
        const da22   = getVal(154, 160);

        // 6. Data Lampu dan Siang/Malam
        const als    = getVal(160, 166);
        const dn     = getVal(166, 170);

        // 7. Jarak pandang, RVR, dan lampu runway (04)
        const vis04  = getVal(170, 176);
        const rvr04  = getVal(176, 182);
        const rlsE04 = getVal(182, 186);
        const rlsC04 = getVal(186, 190);
        const rlsM04 = getVal(190, 194);

        // 8. Jarak pandang, RVR, dan lampu runway (22)
        const vis22  = getVal(194, 200);
        const rvr22  = getVal(200, 206);
        const rlsE22 = getVal(206, 210);
        const rlsC22 = getVal(210, 214);
        const rlsM22 = getVal(214, 218);

        // 9. LR1
        const lr1_04 = getVal(218, 223);
        const lr1_22 = getVal(223, 228);

        // 10. Kondisi Langit (SKY)
        const sky04  = getVal(228, 258);
        const sky22  = getVal(258, 288);

        // 11. Curah Hujan (RA)
        const ra04   = getVal(288, 294);
        const raM    = getVal(294, 300);
        const ra22   = getVal(300, 306);

        // 12. PW (Opsional/Bisa dimasukkan ke general jika perlu)
        const pw04   = getVal(306, 316);
        const pw22   = getVal(316, 326);

        // 13. Solar radiation dan LTX
        const solM   = getVal(326, 332);
        const ltxM   = getVal(332, latestLine.length); // Sampai akhir baris

        // --- BENTUK JSON ---
        latestAwosData = {
            site: "WALS",
            upt: "Stasiun meteorologi Kelas II APT Pranoto Samarinda",
            date: date,
            time_utc: time_utc,
            time_wita: time_wita,
            data: {
                "04": {
                    WS: { value: parseIntVal(ws04), unit: "kt" },
                    WD: { value: parseIntVal(wd04), unit: "deg" },
                    WGS: { value: parseIntVal(wgs04), unit: "kt" },
                    WGD: { value: parseIntVal(wgd04), unit: "deg" },
                    TEMP: { value: parseDecimal(temp04), unit: "degC" },
                    DEWP: { value: parseDecimal(dewp04), unit: "degC" },
                    RH: { value: parseIntVal(rh04), unit: "%" },
                    QNH: { value: parseDecimal(qnh04), unit: "hPa" },
                    DA: { value: parseIntVal(da04), unit: "ft" },
                    ALS: { value: parseIntVal(als), unit: "cd" }, // Sesuai tabel pos 160-166
                    VIS: { value: parseIntVal(vis04), unit: "m" },
                    RVR: { value: parseIntVal(rvr04), unit: "m" },
                    RLS_Edg: { value: rlsE04, unit: "" },
                    RLS_Ctr: { value: rlsC04, unit: "" },
                    RLS_Man: { value: rlsM04, unit: "" },
                    LR1: { value: parseIntVal(lr1_04), unit: "100ft" },
                    SKY: { value: sky04, unit: "" },
                    RA: { value: parseIntVal(ra04), unit: "mm" }
                },
                "M": {
                    WS: { value: parseIntVal(wsM), unit: "kt" },
                    WD: { value: parseIntVal(wdM), unit: "deg" },
                    WGS: { value: parseIntVal(wgsM), unit: "kt" },
                    WGD: { value: parseIntVal(wgdM), unit: "deg" },
                    TEMP: { value: parseDecimal(tempM), unit: "degC" },
                    DEWP: { value: parseDecimal(dewpM), unit: "degC" },
                    RH: { value: parseIntVal(rhM), unit: "%" },
                    QNH: { value: parseDecimal(qnhM), unit: "hPa" },
                    DA: { value: parseIntVal(daM), unit: "ft" },
                    D_N: { value: dn, unit: "" },
                    RA: { value: parseIntVal(raM), unit: "mm" },
                    SOL: { value: parseIntVal(solM), unit: "W/m2" },
                    LTX: { value: ltxM, unit: "" }
                },
                "22": {
                    WS: { value: parseIntVal(ws22), unit: "kt" },
                    WD: { value: parseIntVal(wd22), unit: "deg" },
                    WGS: { value: parseIntVal(wgs22), unit: "kt" },
                    WGD: { value: parseIntVal(wgd22), unit: "deg" },
                    TEMP: { value: parseDecimal(temp22), unit: "degC" },
                    DEWP: { value: parseDecimal(dewp22), unit: "degC" },
                    RH: { value: parseIntVal(rh22), unit: "%" },
                    QNH: { value: parseDecimal(qnh22), unit: "hPa" },
                    DA: { value: parseIntVal(da22), unit: "ft" },
                    VIS: { value: parseIntVal(vis22), unit: "m" },
                    RVR: { value: parseIntVal(rvr22), unit: "m" },
                    RLS_Edg: { value: rlsE22, unit: "" },
                    RLS_Ctr: { value: rlsC22, unit: "" },
                    RLS_Man: { value: rlsM22, unit: "" },
                    LR1: { value: parseIntVal(lr1_22), unit: "100ft" },
                    SKY: { value: sky22, unit: "" },
                    RA: { value: parseIntVal(ra22), unit: "mm" }
                }
            }
        };

        console.log(`[${new Date().toLocaleTimeString()}] Berhasil update data UTC ${time_utc} / WITA ${time_wita}`);

    } catch (error) {
        console.error(`[ERROR] Gagal menarik data: ${error.message}`);
    }
}

// ... (sisa server.js ke bawah tetap sama)

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