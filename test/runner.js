const Jasmine = require('jasmine')
const jasmine = new Jasmine()

jasmine.loadConfig({
	helpers: ['../edge/format.js'],
	stopSpecOnExpectationFailure: false,
	random: false
})

jasmine.configureDefaultReporter({
	showColors: false
})

const glob = require('glob')
const ps = require('process')
const fs = require('fs')
const pt = require('path')
const _ = require('lodash')
const { format } = require('../edge/format.js')

const filteredSpecName = _.chain(ps.argv).map((param, index, array) => (param === '--filter' || param === '-f') ? _.trim(array[index + 1], '"') : null).compact().first().value()

const isDebugging = !!ps.argv.find(param => param === '--debug' || param === '-d')

glob.sync('spec/' + (filteredSpecName || '*'))
	.filter(path => pt.extname(path) === '')
	.forEach(directory => {
		const input = fs.readFileSync(pt.join(directory, 'input.styl'), 'utf8')
		const output = fs.readFileSync(pt.join(directory, 'output.styl'), 'utf8')
		let formattingOptions = null
		if (fs.existsSync(pt.join(directory, 'formattingOptions.json'))) {
			formattingOptions = require('../' + pt.join(directory, 'formattingOptions.json'))
		}

		describe(pt.basename(directory), () => {
			it('', () => {
				const result = format(input, formattingOptions, isDebugging)
				expect(result.content).toBe(output)
				fs.writeFileSync(pt.join(directory, 'actual.styl'), result.content, 'utf8')
			})
		})
	})

jasmine.execute()