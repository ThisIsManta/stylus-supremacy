const checkIfFilePathIsIgnored = require('../edge/checkIfFilePathIsIgnored')
const schema = require("../edge/schema.js")

describe('checkIfFilePathIsIgnored', () => {
	it('returns false given no `ignoreFiles` in the formatting options', () => {
		expect(checkIfFilePathIsIgnored('', '', {})).toBe(false)
		expect(checkIfFilePathIsIgnored('', '', { ignoreFiles: [] })).toBe(false)
	})

	it('returns false given non-matching pattern', () => {
		expect(checkIfFilePathIsIgnored('C:\\test\\file.styl', 'C:\\test', { ignoreFiles: ['nada.styl'] })).toBe(false)
		expect(checkIfFilePathIsIgnored('file.styl', 'C:\\test', { ignoreFiles: ['nada.styl'] })).toBe(false)
	})

	it('returns true given matching pattern', () => {
		expect(checkIfFilePathIsIgnored('C:\\test\\file.styl', 'C:\\test', { ignoreFiles: ['file.styl'] })).toBe(true)
		expect(checkIfFilePathIsIgnored('file.styl', 'C:\\test', { ignoreFiles: ['file.styl'] })).toBe(true)
	})

	it('has `ignoreFiles` in the formatting option schema', () => {
		expect(schema.ignoreFiles).toBeDefined()
	})
})