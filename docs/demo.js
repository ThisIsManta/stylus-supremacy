const format = require('format')

$(document).ready(function () {
	const $input = $('#try-input')
	const $output = $('#try-output')
	$input.on('input', function (e) {
		try {
			const result = format(e.target.value)
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
	})

	// Set default input
	if ($input.val().trim() === '') {
		$input.val('body\n  background red')
		setTimeout(function () {
			$input.trigger('input')
		})
	}
})