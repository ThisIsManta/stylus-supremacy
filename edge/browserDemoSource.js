const format = require('./format')
const createCodeForHTML = require('./createCodeForHTML')

$(document).ready(function () {
	const $input = $('#demo-input')
	const $output = $('#demo-output')
	$input.on('input', reformat)
	$input.on('keydown', insertTwoSpacesInsteadOfTab)
	$input.add($output).on('mousewheel', stopScrollingOutside)
	$('#demo-options input, #demo-options select').on('change', reformat)
	setTimeout(reformat, 600)

	// Set default input
	if ($input.val().trim().length === 0) {
		$input.val([
			'@require "./file.styl"',
			'/**',
			'multi-line comment',
			'*/',
			'.class1, .class2',
			'  padding 1px // comment',
			'  margin 0px 5px 0px 5px',
			'  color alpha(red, 0.5)',
			'  if (!condition)',
			'    @extend .class3',
			'  else',
			'    background blue',
			'  block =',
			'    display none',
		].join('\n'))
	}

	function reformat() {
		const options = {}
		$('#demo input[type=checkbox]').toArray().forEach(elem => {
			options[elem.id.substring(5)] = elem.checked
		})
		$('#demo input[type=text]').toArray().forEach(elem => {
			options[elem.id.substring(5)] = elem.value
		})
		$('#demo input[type=number]').toArray().forEach(elem => {
			options[elem.id.substring(5)] = parseFloat(elem.value)
		})
		$('#demo select').toArray().forEach(elem => {
			options[elem.id.substring(5)] = JSON.parse(elem.value)
		})

		try {
			const result = format($input.val(), options)
			$output.removeClass('error').html(createCodeForHTML(result))
		} catch (ex) {
			console.error(ex)
			$output.addClass('error').text(ex.message).prepend('<b>ERROR</b>: <br>')
		}
	}

	function insertTwoSpacesInsteadOfTab(e) {
		if (e.which === 9 /* Tab */) {
			// Insert 2 spaces instead of a tab
			const cursor = e.target.selectionStart
			e.target.value = e.target.value.substring(0, cursor) + '  ' + e.target.value.substring(e.target.selectionEnd)
			e.target.selectionStart = cursor + 2
			e.target.selectionEnd = cursor + 2

			e.preventDefault()
		}
	}

	function stopScrollingOutside(e) {
		if (e.target.scrollTop === 0 && e.originalEvent.deltaY < 0 || e.target.scrollTop + e.target.clientHeight === e.target.scrollHeight && e.originalEvent.deltaY > 0) {
			e.preventDefault()
		}
	}
})
