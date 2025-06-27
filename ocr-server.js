// Minimal OCR microservice using tesseract.js-node
// Run with: node ocr-server.js

const express = require('express');
const cors = require('cors');
const Tesseract = require('tesseract.js');

const app = express();
const PORT = 4001;

app.use(cors());
app.use(express.json({ limit: '25mb' }));

app.post('/ocr', async (req, res) => {
  try {
    const { image } = req.body;
    if (!image) return res.status(400).json({ error: 'No image provided' });

    let imageBuffer;
    if (typeof image === 'string' && image.startsWith('http')) {
      const response = await fetch(image);
      if (!response.ok) return res.status(400).json({ error: 'Failed to fetch image URL' });
      const arrayBuffer = await response.arrayBuffer();
      imageBuffer = Buffer.from(arrayBuffer);
    } else if (typeof image === 'string' && image.startsWith('data:image/')) {
      const base64 = image.split(',')[1];
      imageBuffer = Buffer.from(base64, 'base64');
    } else if (typeof image === 'string') {
      imageBuffer = Buffer.from(image, 'base64');
    } else {
      return res.status(400).json({ error: 'Invalid image input' });
    }

    // Log image buffer info for debugging
    console.log('OCR request:', {
      imageType: typeof image,
      imageLength: image.length,
      bufferLength: imageBuffer.length,
      startsWith: image.slice(0, 30)
    });

    // Quick validation: buffer length and magic number check (PNG/JPEG)
    const isPng = imageBuffer.slice(0, 8).toString('hex') === '89504e470d0a1a0a';
    const isJpg = imageBuffer.slice(0, 3).toString('hex') === 'ffd8ff';
    if (imageBuffer.length < 100 || (!isPng && !isJpg)) {
      console.warn('Rejected invalid image buffer. Length:', imageBuffer.length);
      return res.status(400).json({ error: 'Invalid or unsupported image format' });
    }

    try {
      const result = await Tesseract.recognize(imageBuffer, 'eng');
      res.json({ text: result.data.text });
    } catch (ocrError) {
      // Tesseract.js throws on corrupt/invalid image
      console.error('Tesseract error:', ocrError.message);
      return res.status(400).json({ error: 'Image decode/OCR failed', details: ocrError.message });
    }
  } catch (error) {
    console.error('OCR microservice error:', error.message);
    res.status(500).json({ error: 'Failed to process image', details: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`OCR microservice running on http://localhost:${PORT}/ocr`);
});
