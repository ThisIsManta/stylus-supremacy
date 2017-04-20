const createFormattingOptions = require('../edge/createFormattingOptions')
const formattingOptionSchema = require('../edge/formattingOptionSchema.json')

describe('createFormattingOptions', () => {
	it('returns the default formatting options given an empty object', () => {
		expect(Object.keys(createFormattingOptions())).toEqual(Object.keys(formattingOptionSchema))
	})

	it('returns the default value given `undefined`', () => {
		expect(createFormattingOptions().insertColons).toBe(formattingOptionSchema.insertColons.default)
	})

	it('returns the same value given a valid value', () => {
		expect(createFormattingOptions({ insertColons: true }).insertColons).toBe(true)
		expect(createFormattingOptions({ insertColons: false }).insertColons).toBe(false)
	})

	it('throws an eror given an invalid value', () => {
		expect(() => createFormattingOptions({ insertColons: null })).toThrow()
	})
})
