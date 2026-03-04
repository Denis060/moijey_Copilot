const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const url = 'http://localhost:3000/api/knowledge/upload';

async function testUpload() {
    console.log("--- Starting Manual Upload POST test ---");

    const filePath = path.join(__dirname, '../test.pdf');
    if (!fs.existsSync(filePath)) {
        console.error("test.pdf not found at", filePath);
        return;
    }
    const form = new FormData();
    form.append('file', fs.createReadStream(filePath), {
        filename: 'test.pdf',
        contentType: 'application/pdf',
    });
    form.append('title', 'Manual PDF Test');
    form.append('category', 'Debug');

    try {
        const response = await axios.post(url, form, {
            headers: {
                ...form.getHeaders(),
                'x-test-bypass': 'debug-parsing'
            },
        });
        console.log("Response:", response.status, response.data);
    } catch (error) {
        if (error.response) {
            console.log("Response Error:", error.response.status, error.response.data);
        } else {
            console.error("Error:", error.message);
        }
    }
}

testUpload();
