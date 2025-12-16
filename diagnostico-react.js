const fs = require('fs');
const path = require('path');

const components = [
  'src/components/SupervisorDashboard.js',
  'src/components/EjecutivoDashboard.js',
  'src/App.js'
];
const cssFiles = [
  'src/components/SupervisorDashboard.css',
  'src/components/EjecutivoDashboard.css',
  'src/App.css'
];

function checkFileExists(file) {
  if (!fs.existsSync(file)) {
    console.error(`[ERROR] No existe: ${file}`);
    return false;
  }
  console.log(`[OK] Existe: ${file}`);
  return true;
}

function checkCssImport(jsFile, cssFile) {
  const content = fs.readFileSync(jsFile, 'utf8');
  if (content.includes(`"${cssFile.split('/').pop()}"`) || content.includes(`'${cssFile.split('/').pop()}'`)) {
    console.log(`[OK] ${jsFile} importa ${cssFile}`);
  } else {
    console.warn(`[WARN] ${jsFile} NO importa ${cssFile}`);
  }
}

function checkJsxSyntax(jsFile) {
  const content = fs.readFileSync(jsFile, 'utf8');
  if (content.includes('return (')) {
    console.log(`[OK] ${jsFile} tiene un bloque JSX principal`);
  } else {
    console.warn(`[WARN] ${jsFile} NO tiene un bloque JSX principal`);
  }
}

console.log('--- Diagnóstico de archivos principales ---');
components.forEach(file => checkFileExists(file));
cssFiles.forEach(file => checkFileExists(file));

console.log('\n--- Diagnóstico de imports de CSS ---');
checkCssImport(components[0], cssFiles[0]);
checkCssImport(components[1], cssFiles[1]);
checkCssImport(components[2], cssFiles[2]);

console.log('\n--- Diagnóstico de JSX ---');
components.forEach(checkJsxSyntax);

console.log('\nDiagnóstico terminado.');
