import fs from 'fs';
import path from 'path';

/**
 * Saves a Base64 image string to a file and returns the relative path.
 * If the string is already a path or invalid, it returns it as-is.
 * @param {string} base64Data - The image data (Base64 or URL).
 * @param {string} subfolder - 'profiles' or 'logos'.
 * @returns {string} - The path to the saved file or the original string.
 */
export function processImage(base64Data, subfolder) {
    if (!base64Data || !base64Data.startsWith('data:image')) {
        return base64Data;
    }

    try {
        // Extract format and actual base64 string
        const matches = base64Data.match(/^data:image\/([A-Za-z-+\/]+);base64,(.+)$/);
        if (!matches || matches.length !== 3) return base64Data;

        const extension = matches[1];
        const imageData = matches[2];
        const filename = `${subfolder}_${Date.now()}_${Math.floor(Math.random() * 1000)}.${extension === 'jpeg' ? 'jpg' : extension}`;
        
        const uploadsDir = path.join(process.cwd(), 'uploads', subfolder);
        const filePath = path.join(uploadsDir, filename);

        fs.writeFileSync(filePath, Buffer.from(imageData, 'base64'));
        
        // Return the relative URL path
        return `/uploads/${subfolder}/${filename}`;
    } catch (err) {
        console.error('Error processing image:', err);
        return base64Data;
    }
}
