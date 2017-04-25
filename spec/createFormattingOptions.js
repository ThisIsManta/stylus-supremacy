const createFormattingOptions = require('../edge/createFormattingOptions')

describe('createFormattingOptions', () => {
	it('returns the default formatting options given an empty object', () => {
		expect(Object.keys(createFormattingOptions())).toEqual(Object.keys(createFormattingOptions.schema))
	})

	it('returns the default value given `undefined`', () => {
		expect(createFormattingOptions().insertColons).toBe(createFormattingOptions.schema.insertColons.default)
	})

	it('returns the same value given a valid value', () => {
		expect(createFormattingOptions({ insertColons: true }).insertColons).toBe(true)
		expect(createFormattingOptions({ insertColons: false }).insertColons).toBe(false)
	})

	it('throws an eror given an invalid value', () => {
		expect(() => createFormattingOptions({ insertColons: null })).toThrow()
	})
})
