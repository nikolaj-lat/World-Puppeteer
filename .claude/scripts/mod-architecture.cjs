#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const SUPPORTED_SCHEMA_KEYWORDS = new Set([
  '$schema',
  '$id',
  'title',
  'description',
  'type',
  'required',
  'additionalProperties',
  'properties',
  'const',
  'enum',
  'pattern',
  'minLength',
  'minItems',
  'uniqueItems',
  'items',
  'not',
]);

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isSafeRelativePath(value) {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    !path.isAbsolute(value) &&
    !value.split(/[\\/]+/).includes('..')
  );
}

function readJsonResult(filePath) {
  try {
    return { value: JSON.parse(fs.readFileSync(filePath, 'utf8')), error: null };
  } catch (error) {
    return { value: null, error: `${filePath}: invalid JSON: ${error.message}` };
  }
}

function valueType(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (Number.isInteger(value)) return 'integer';
  return typeof value;
}

function deepKey(value) {
  return JSON.stringify(value);
}

function unsupportedSchemaKeywords(schema, schemaPath = '$schema') {
  const errors = [];
  if (!isPlainObject(schema)) return errors;
  for (const key of Object.keys(schema)) {
    if (!SUPPORTED_SCHEMA_KEYWORDS.has(key)) errors.push(`${schemaPath}: unsupported schema keyword ${key}`);
  }
  for (const [property, childSchema] of Object.entries(schema.properties || {})) {
    errors.push(...unsupportedSchemaKeywords(childSchema, `${schemaPath}.properties.${property}`));
  }
  if (isPlainObject(schema.items)) errors.push(...unsupportedSchemaKeywords(schema.items, `${schemaPath}.items`));
  if (isPlainObject(schema.not)) errors.push(...unsupportedSchemaKeywords(schema.not, `${schemaPath}.not`));
  if (isPlainObject(schema.additionalProperties)) {
    errors.push(...unsupportedSchemaKeywords(schema.additionalProperties, `${schemaPath}.additionalProperties`));
  }
  return errors;
}

function validateAgainstSchema(value, schema, instancePath = '$') {
  const errors = [];
  if (!isPlainObject(schema)) return [`${instancePath}: schema must be an object`];

  if ('const' in schema && deepKey(value) !== deepKey(schema.const)) {
    errors.push(`${instancePath}: must equal ${JSON.stringify(schema.const)}`);
  }
  if (Array.isArray(schema.enum) && !schema.enum.some((item) => deepKey(item) === deepKey(value))) {
    errors.push(`${instancePath}: must be one of ${schema.enum.map((item) => JSON.stringify(item)).join(', ')}`);
  }

  if (schema.type) {
    const actual = valueType(value);
    const allowed = Array.isArray(schema.type) ? schema.type : [schema.type];
    const typeMatches = allowed.some((expected) => {
      if (expected === 'number') return typeof value === 'number' && Number.isFinite(value);
      if (expected === 'integer') return Number.isInteger(value);
      if (expected === 'object') return isPlainObject(value);
      if (expected === 'array') return Array.isArray(value);
      if (expected === 'null') return value === null;
      return typeof value === expected;
    });
    if (!typeMatches) {
      errors.push(`${instancePath}: expected ${allowed.join('|')}, got ${actual}`);
      return errors;
    }
  }

  if (typeof value === 'string') {
    if (Number.isInteger(schema.minLength) && value.length < schema.minLength) {
      errors.push(`${instancePath}: must contain at least ${schema.minLength} characters`);
    }
    if (schema.pattern) {
      try {
        if (!new RegExp(schema.pattern).test(value)) errors.push(`${instancePath}: does not match pattern ${schema.pattern}`);
      } catch (error) {
        errors.push(`${instancePath}: invalid schema pattern ${schema.pattern}: ${error.message}`);
      }
    }
  }

  if (Array.isArray(value)) {
    if (Number.isInteger(schema.minItems) && value.length < schema.minItems) {
      errors.push(`${instancePath}: must contain at least ${schema.minItems} items`);
    }
    if (schema.uniqueItems) {
      const seen = new Set();
      for (const item of value) {
        const key = deepKey(item);
        if (seen.has(key)) errors.push(`${instancePath}: contains duplicate items`);
        seen.add(key);
      }
    }
    if (schema.items) {
      value.forEach((item, index) => errors.push(...validateAgainstSchema(item, schema.items, `${instancePath}[${index}]`)));
    }
  }

  if (isPlainObject(value)) {
    for (const key of schema.required || []) {
      if (!(key in value)) errors.push(`${instancePath}.${key}: required property missing`);
    }
    const properties = schema.properties || {};
    for (const [key, child] of Object.entries(value)) {
      if (properties[key]) errors.push(...validateAgainstSchema(child, properties[key], `${instancePath}.${key}`));
      else if (schema.additionalProperties === false) errors.push(`${instancePath}.${key}: additional property is not allowed`);
      else if (isPlainObject(schema.additionalProperties)) {
        errors.push(...validateAgainstSchema(child, schema.additionalProperties, `${instancePath}.${key}`));
      }
    }
  }

  if (schema.not && validateAgainstSchema(value, schema.not, instancePath).length === 0) {
    errors.push(`${instancePath}: matches forbidden schema`);
  }
  return errors;
}

function validateAgainstSchemaFile(value, schemaPath) {
  const loaded = readJsonResult(schemaPath);
  if (loaded.error) return [loaded.error];
  const unsupported = unsupportedSchemaKeywords(loaded.value);
  if (unsupported.length > 0) return unsupported;
  return validateAgainstSchema(value, loaded.value);
}

function getByPath(value, dottedPath) {
  if (!dottedPath) return value;
  return dottedPath.split('.').reduce((current, segment) => {
    if (current === undefined || current === null) return undefined;
    return current[segment];
  }, value);
}

function collisionKeys(sourceValue, targetValue, targetPath) {
  if (targetValue === undefined) return [];
  if (isPlainObject(sourceValue) && isPlainObject(targetValue)) {
    return Object.keys(sourceValue)
      .filter((key) => Object.prototype.hasOwnProperty.call(targetValue, key))
      .sort();
  }
  return [targetPath];
}

function authoritative() {
  return require('./mod-architecture-v2.cjs');
}

module.exports = {
  collisionKeys,
  getByPath,
  isSafeRelativePath,
  readJsonResult,
  unsupportedSchemaKeywords,
  validateAgainstSchema,
  validateAgainstSchemaFile,
  createDryRunPlan: (...args) => authoritative().createDryRunPlan(...args),
  detectDependencyCycle: (...args) => authoritative().detectDependencyCycle(...args),
  listModPayloadFiles: (...args) => authoritative().listModPayloadFiles(...args),
  validateAppliedMods: (...args) => authoritative().validateAppliedMods(...args),
  validateModManifest: (...args) => authoritative().validateModManifest(...args),
  validateModRegistry: (...args) => authoritative().validateModRegistry(...args),
};
