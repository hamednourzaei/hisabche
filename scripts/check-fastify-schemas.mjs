import fs from 'node:fs'
import path from 'node:path'

const dir = 'backend/src/routes'
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.ts'))
const schemaIssues = []

for (const f of files) {
  const content = fs.readFileSync(`${dir}/${f}`, 'utf8')
  // Check for response schemas that use { type: 'string' } on nullable fields or omit fields
  // Specifically look for fastify response schema definitions
  const responseSchemaRegex = /response:\s*\{\s*(\d{3}):\s*([^\}]+)\}/g
  let m
  while ((m = responseSchemaRegex.exec(content)) !== null) {
    const code = m[1]
    const schemaDef = m[2]
    // If it mentions type: 'string' directly without nullable or array
    if (
      schemaDef.includes("type: 'string'") &&
      !schemaDef.includes('nullable: true') &&
      !schemaDef.includes("['string', 'null']")
    ) {
      // Check surrounding lines
      const line = content.slice(0, m.index).split('\n').length
      schemaIssues.push({
        file: f,
        line,
        code,
        schemaSnippet: schemaDef.slice(0, 100).replace(/\s+/g, ' '),
      })
    }
  }
}

console.log('Fastify schema serialization potential issues:', schemaIssues.length)
console.log('Sample schema issues:', schemaIssues.slice(0, 10))
