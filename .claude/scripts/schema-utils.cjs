const fs = require('fs');
const Ajv2020 = require('ajv/dist/2020');

function readJsonResult(filePath) {
  try {
    return { value: JSON.parse(fs.readFileSync(filePath, 'utf8')), error: null };
  } catch (error) {
    return { value: null, error: `${filePath}: invalid JSON: ${error.message}` };
  }
}

function formatAjvError(error) {
  const path = error.instancePath || '$';
  const detail = error.params && error.keyword === 'additionalProperties'
    ? ` (${error.params.additionalProperty})`
    : '';
  return `${path}: ${error.message}${detail}`;
}

function validateAgainstSchema(value, schema, schemaPath = 'schema') {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const validate = ajv.compile(schema);
  if (validate(value)) return [];
  return (validate.errors || []).map((error) => `${schemaPath}: ${formatAjvError(error)}`);
}

function validateAgainstSchemaFile(value, schemaPath) {
  const loaded = readJsonResult(schemaPath);
  if (loaded.error) return [loaded.error];
  return validateAgainstSchema(value, loaded.value, schemaPath);
}

module.exports = {
  readJsonResult,
  validateAgainstSchema,
  validateAgainstSchemaFile,
};
