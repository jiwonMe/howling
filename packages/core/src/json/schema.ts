/**
 * JSON Schema subset 검증기.
 * type, required, properties, additionalProperties, items, enum, const, 범위만 지원한다.
 * AJV를 넣지 않아 브라우저 번들 없이 동작한다.
 */
import type { JsonObject, JsonValue } from "../contracts/json.js";
import { isFiniteNumber, isJsonValue } from "./is-json.js";

export interface SchemaIssue {
  readonly path: string;
  readonly message: string;
}

const issue = (path: string, message: string): SchemaIssue => ({
  path,
  message,
});

const childPath = (path: string, key: string): string =>
  path === "" ? `/${key}` : `${path}/${key}`;

const schemaType = (schema: JsonObject): string | undefined => {
  const value = schema.type;
  return typeof value === "string" ? value : undefined;
};

const matchesType = (value: JsonValue, type: string): boolean => {
  if (type === "null") {
    return value === null;
  }
  if (type === "boolean") {
    return typeof value === "boolean";
  }
  if (type === "number" || type === "integer") {
    return isFiniteNumber(value) && (type === "number" || Number.isInteger(value));
  }
  if (type === "string") {
    return typeof value === "string";
  }
  if (type === "array") {
    return Array.isArray(value);
  }
  if (type === "object") {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }
  return false;
};

const validateConst = (
  schema: JsonObject,
  value: JsonValue,
  path: string,
): SchemaIssue[] => {
  if (!Object.hasOwn(schema, "const")) {
    return [];
  }
  return JSON.stringify(schema.const) === JSON.stringify(value)
    ? []
    : [issue(path, "value does not match const")];
};

const validateEnum = (
  schema: JsonObject,
  value: JsonValue,
  path: string,
): SchemaIssue[] => {
  if (!Array.isArray(schema.enum)) {
    return [];
  }
  const encoded = JSON.stringify(value);
  return schema.enum.some((item) => JSON.stringify(item) === encoded)
    ? []
    : [issue(path, "value is not in enum")];
};

const validateNumber = (
  schema: JsonObject,
  value: number,
  path: string,
): SchemaIssue[] => {
  const issues: SchemaIssue[] = [];
  if (isFiniteNumber(schema.minimum) && value < schema.minimum) {
    issues.push(issue(path, "number is below minimum"));
  }
  if (isFiniteNumber(schema.maximum) && value > schema.maximum) {
    issues.push(issue(path, "number is above maximum"));
  }
  return issues;
};

const validateString = (
  schema: JsonObject,
  value: string,
  path: string,
): SchemaIssue[] => {
  const issues: SchemaIssue[] = [];
  if (isFiniteNumber(schema.minLength) && value.length < schema.minLength) {
    issues.push(issue(path, "string is shorter than minLength"));
  }
  if (isFiniteNumber(schema.maxLength) && value.length > schema.maxLength) {
    issues.push(issue(path, "string is longer than maxLength"));
  }
  return issues;
};

const additionalAllowed = (schema: JsonObject): boolean =>
  schema.additionalProperties !== false;

export const validateJsonSchema = (
  schema: JsonObject,
  value: JsonValue,
  path = "",
): SchemaIssue[] => {
  const type = schemaType(schema);
  if (type !== undefined && !matchesType(value, type)) {
    return [issue(path, `expected type ${type}`)];
  }
  const issues = [
    ...validateConst(schema, value, path),
    ...validateEnum(schema, value, path),
  ];
  if (typeof value === "number") {
    issues.push(...validateNumber(schema, value, path));
  }
  if (typeof value === "string") {
    issues.push(...validateString(schema, value, path));
  }
  if (Array.isArray(value)) {
    issues.push(...validateArray(schema, value, path));
  }
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    issues.push(...validateObject(schema, value, path));
  }
  return issues;
};

const validateArray = (
  schema: JsonObject,
  value: JsonValue[],
  path: string,
): SchemaIssue[] => {
  const issues: SchemaIssue[] = [];
  if (isFiniteNumber(schema.minItems) && value.length < schema.minItems) {
    issues.push(issue(path, "array is shorter than minItems"));
  }
  if (isFiniteNumber(schema.maxItems) && value.length > schema.maxItems) {
    issues.push(issue(path, "array is longer than maxItems"));
  }
  if (isJsonValue(schema.items) && typeof schema.items === "object" && !Array.isArray(schema.items)) {
    value.forEach((item, index) => {
      issues.push(
        ...validateJsonSchema(schema.items as JsonObject, item, childPath(path, String(index))),
      );
    });
  }
  return issues;
};

const validateObject = (
  schema: JsonObject,
  value: JsonObject,
  path: string,
): SchemaIssue[] => {
  const issues: SchemaIssue[] = [];
  const required = Array.isArray(schema.required)
    ? schema.required.filter((item): item is string => typeof item === "string")
    : [];
  for (const key of required) {
    if (!Object.hasOwn(value, key)) {
      issues.push(issue(childPath(path, key), "required property is missing"));
    }
  }
  const properties =
    schema.properties !== null &&
    typeof schema.properties === "object" &&
    !Array.isArray(schema.properties)
      ? schema.properties
      : {};
  for (const key of Object.keys(value)) {
    const propertySchema = properties[key];
    if (
      propertySchema !== undefined &&
      typeof propertySchema === "object" &&
      propertySchema !== null &&
      !Array.isArray(propertySchema)
    ) {
      const field = value[key];
      if (field !== undefined) {
        issues.push(...validateJsonSchema(propertySchema, field, childPath(path, key)));
      }
      continue;
    }
    if (!additionalAllowed(schema)) {
      issues.push(issue(childPath(path, key), "additional property is not allowed"));
    }
  }
  return issues;
};
