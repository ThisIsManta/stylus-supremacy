const fs = require('fs')

const packageJSON = require('../package.json')

const text = `
- id: ${packageJSON.name}
  name: 'Stylus Supremacy'
  description: 'Format Stylus files'
  language: node
  types: [stylus]
  additional_dependencies: ['stylus-supremacy@${packageJSON.version}']
  entry: 'stylus-supremacy format --replace'
`.trim()

fs.writeFileSync('./.pre-commit-hooks.yaml', text, { encoding: 'utf-8' })
