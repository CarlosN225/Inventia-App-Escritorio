const express = require('express');
const path = require('path');

const app = express();

const distPath = path.join(__dirname, '..', 'dist');

app.use(express.static(distPath));

app.use((req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(4173, '127.0.0.1', () => {
    console.log('React iniciado en http://127.0.0.1:4173');
});