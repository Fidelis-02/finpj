require('dotenv').config();

const express = require('express');
const path = require('path');
const app = require('./server');

const PORT = process.env.PORT || 3001;

app.use(express.static(path.join(__dirname, 'public')));
app.use('/tax', express.static(path.join(__dirname, 'src', 'tax')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/logo.svg', (req, res) => {
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.sendFile(path.join(__dirname, 'public', 'logo.svg'));
});

app.listen(PORT, () => {
    console.log(`FinPJ em http://localhost:${PORT}`);
});
