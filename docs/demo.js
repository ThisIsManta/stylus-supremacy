const format = require('format')

$(document).ready(function () {
	const $input = $('#demo-input')
	const $output = $('#demo-output')
	$input.on('input', reformat)
	$input.on('input', saveToLocalStorage)
	$input.on('keydown', insertTwoSpacesInsteadOfTab)
	$('#demo-options input, #demo-options select').on('change', reformat)
	setTimeout(reformat, 600)

	// Load saved input from local storage
	if (window.localStorage) {
		$input.val(window.localStorage.getItem('input'))
	}
	
	// Set default input
	if ($input.val().trim().length === 0) {
		$input.val([
			'@require "./file.styl"',
			'.class1, .class2',
			'  color alpha(red, 0.5)',
			'  padding 1px // comment',
			'  margin 0px 5px 0px 5px',
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
				.split(/\r?\n/)
				.map(line => line
					.replace(/^\t+/, s => '  '.repeat(s.length))
					.replace(/^\s+/, s => '&nbsp;'.repeat(s.length))
				)
				.join('<br>')
			$output.removeClass('error').html(result)
		} catch (ex) {
			$output.addClass('error').text(ex.message).prepend('<b>ERROR</b>: <br>')
		}
	}

	function saveToLocalStorage(e) {
		if (window.localStorage) {
			if (e.target.value.trim().length > 0) {
				window.localStorage.setItem('input', e.target.value)
			} else {
				window.localStorage.removeItem('input')
			}
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
})