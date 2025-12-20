const fs = require('fs');
const path = require('path');

const files = [
    { json: 'BASE_CADASTRO.json', js: 'data_cadastro.js', varName: 'DB_CADASTRO' },
    { json: 'BASE_END.json', js: 'data_end.js', varName: 'DB_END' }
];

files.forEach(file => {
    try {
        const jsonPath = path.join(__dirname, file.json);
        const jsPath = path.join(__dirname, file.js);

        if (fs.existsSync(jsonPath)) {
            console.log(`Reading ${file.json}...`);
            const content = fs.readFileSync(jsonPath, 'utf8');
            const jsContent = `window.${file.varName} = ${content};`;

            console.log(`Writing ${file.js}...`);
            fs.writeFileSync(jsPath, jsContent, 'utf8');
            console.log(`Success: ${file.js} created.`);
        } else {
            console.error(`Error: ${file.json} not found.`);
        }
    } catch (err) {
        console.error(`Failed to convert ${file.json}:`, err);
    }
});
