#!/usr/bin/env node

const ps = require('process')

const process = require('commandLineProcessor')

process(ps.argv[2], ps.argv.slice(3))