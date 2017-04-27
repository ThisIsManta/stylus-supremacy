const format = require('format')

$(document).ready(function () {
	const $input = $('#demo-input')
	const $output = $('#demo-output')
	$input.on('input', reformat)

	// Set default input
	if ($input.val().trim() === '') {
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
		
		setTimeout(reformat)
	}

	$('#demo-options input, #demo-options select').on('change', reformat)

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
})