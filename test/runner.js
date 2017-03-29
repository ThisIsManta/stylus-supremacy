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
const fs = require('fs')
const pt = require('path')
const { format } = require('../edge/format.js')

glob.sync('spec/*').filter(path => pt.extname(path) === '').forEach(directory => {
	const input = fs.readFileSync(pt.join(directory, 'input.styl'), 'utf8')
	const output = fs.readFileSync(pt.join(directory, 'output.styl'), 'utf8')
	let formattingOptions = null
	if (fs.existsSync(pt.join(directory, 'formattingOptions.json'))) {
		formattingOptions = require('../' + pt.join(directory, 'formattingOptions.json'))
	}

	describe(pt.basename(directory), () => {
		it('returns formatted content', () => {
			const result = format(input, formattingOptions)
			expect(result.content).toBe(output)
		})
	})
})

jasmine.execute()