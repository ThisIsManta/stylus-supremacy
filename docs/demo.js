const format = require('../edge/format')

$(document).ready(function () {
	const $input = $('#try-input')
	const $output = $('#try-output')
	$input.on('input', function (e) {
		try {
			const result = format(e.target.value)
				.replace(/\r/g, '')
				.replace(/^\s+/gm, function (s) { return '&nbsp;'.repeat(s.length) })
				.replace(/^\t+/gm, function (s) { return '&nbsp;&nbsp;'.repeat(s.length) })
				.replace(/\n/g, '<br>')
			$output.removeClass('error').html(result)
		} catch (ex) {
			$output.addClass('error').text(ex.message).prepend('<b>ERROR</b>: <br>')
		}
	})

	// Set default input
	$input.val('body\n  background red')
	setTimeout(function () {
		$input.trigger('input')
	})
})