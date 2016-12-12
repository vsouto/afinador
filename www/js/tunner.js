
// Define the set of test frequencies that we'll use to analyze microphone data.
var C2 = 65.41; // C2 note, in Hz.
var notes = [ "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B" ];
var notes_complete = { 
	"C" : 130,
	"D" : 146, 
	"E" : 165, 
	"F" : 174, 
	"G" : 196,
	"A" : 110,
	"B" : 123 };
	
var test_frequencies = [];
for (var i = 0; i < 30; i++)
{
	var note_frequency = C2 * Math.pow(2, i / 12);
	var note_name = notes[i % 12];
	var note = { "frequency": note_frequency, "name": note_name };
	var just_above = { "frequency": note_frequency * Math.pow(2, 1 / 48), "name": note_name + " (um pouco acima)" };
	var just_below = { "frequency": note_frequency * Math.pow(2, -1 / 48), "name": note_name + " (um pouco abaixo)" };
	test_frequencies = test_frequencies.concat([ just_below, note, just_above ]);
}

window.addEventListener("load", initialize);

var correlation_worker = new Worker("js/correlation_worker.js");
correlation_worker.addEventListener("message", interpret_correlation_result);

function initialize()
{
	var get_user_media = navigator.getUserMedia;
	get_user_media = get_user_media || navigator.webkitGetUserMedia;
	get_user_media = get_user_media || navigator.mozGetUserMedia;
	get_user_media.call(navigator, { "audio": true }, use_stream, function() {});

	//document.getElementById("play-note").addEventListener("click", toggle_playing_note);
}

function use_stream(stream)
{
	var audio_context = new AudioContext();
	var microphone = audio_context.createMediaStreamSource(stream);
	window.source = microphone; // Workaround for https://bugzilla.mozilla.org/show_bug.cgi?id=934512
	var script_processor = audio_context.createScriptProcessor(1024, 1, 1);

	script_processor.connect(audio_context.destination);
	microphone.connect(script_processor);

	var buffer = [];
	var sample_length_milliseconds = 100;
	var recording = true;

	// Need to leak this function into the global namespace so it doesn't get
	// prematurely garbage-collected.
	// http://lists.w3.org/Archives/Public/public-audio/2013JanMar/0304.html
	window.capture_audio = function(event)
	{
		if (!recording)
			return;

		buffer = buffer.concat(Array.prototype.slice.call(event.inputBuffer.getChannelData(0)));

		// Stop recording after sample_length_milliseconds.
		if (buffer.length > sample_length_milliseconds * audio_context.sampleRate / 1000)
		{
			recording = false;

			correlation_worker.postMessage
			(
				{
					"timeseries": buffer,
					"test_frequencies": test_frequencies,
					"sample_rate": audio_context.sampleRate
				}
			);

			buffer = [];
			setTimeout(function() { recording = true; }, 250);
		}
	};

	script_processor.onaudioprocess = window.capture_audio;
}

function interpret_correlation_result(event)
{
	var timeseries = event.data.timeseries;
	var frequency_amplitudes = event.data.frequency_amplitudes;
	
	// Compute the (squared) magnitudes of the complex amplitudes for each
	// test frequency.
	var magnitudes = frequency_amplitudes.map(function(z) { return z[0] * z[0] + z[1] * z[1]; });
	
	// Find the maximum in the list of magnitudes.
	var maximum_index = -1;
	var maximum_magnitude = 0;
	for (var i = 0; i < magnitudes.length; i++)
	{
		if (magnitudes[i] <= maximum_magnitude)
			continue;

		maximum_index = i;
		maximum_magnitude = magnitudes[i];
	}

	// Compute the average magnitude. We'll only pay attention to frequencies
	// with magnitudes significantly above average.
	var average = magnitudes.reduce(function(a, b) { return a + b; }, 0) / magnitudes.length;
	var confidence = maximum_magnitude / average;
	var confidence_threshold = 10; // empirical, arbitrary.
	if (confidence > confidence_threshold)
	{
		// dominant frequency é a frequencia mais alta alcançada
		var dominant_frequency = test_frequencies[maximum_index];
		document.getElementById("note-name").textContent = dominant_frequency.name;
		document.getElementById("frequency").textContent = dominant_frequency.frequency;
						
		$('#log-value8').html( 'magnitude prox: ' + test_frequencies[maximum_index]);
		$('#log-value9').html( 'nota de que se trata: ' + dominant_frequency.name[0]);
		$('#log-value10').html( 'freq da nota: ' + notes_complete[dominant_frequency.name[0]]);
		console.debug( test_frequencies[maximum_index]);
				
		// Oitavou? abaixa (só no grafico)
		var frequencia_atual = (dominant_frequency.frequency > 200)? dominant_frequency.frequency/2 : dominant_frequency.frequency;
			
		// Fazendo regra de 3, pra comparar a nota em uma escala de 0 a 4
		var nota_escalada = frequencia_atual * 0.005 / notes_complete[dominant_frequency.name[0]];
		
		// Se a frequencia é uma nota perfeita
		//var cor = (parseFloat(nota_escalada).toFixed(2) == 0.05)? '#86efaf' : '#eed5d2';
		console.debug('==' + Math.round(parseFloat(frequencia_atual).toFixed(2)) );
		console.debug('==' + Math.round(parseFloat(notes_complete[dominant_frequency.name[0]])) );
		var cor = (Math.round(frequencia_atual) == Math.round(notes_complete[dominant_frequency.name[0]]) )? '#86efaf' : '#eed5d2';
		
		// graph
		var opts = {
		  lines: 12, // The number of lines to draw
		  angle: 0.15, // The length of each line
		  lineWidth: 0.44, // The line thickness
		  pointer: {
			length: 0.9, // The radius of the inner circle
			strokeWidth: 0.035, // The rotation offset
			color: '#000000' // Fill color
		  },
		  limitMax: 'true',   // If true, the pointer will not go past the end of the gauge
		  colorStart: '#6FADCF',   // Colors
		  colorStop: cor,    // just experiment with them
		  strokeColor: '#E0E0E0',   // to see which ones work best for you
		  generateGradient: true
		};
		var target = document.getElementById('foo'); // your canvas element
		var gauge = new Gauge(target).setOptions(opts); // create sexy gauge!
		
		gauge.maxValue = 0.01; // set max gauge value
		gauge.animationSpeed = 1; // set animation speed (32 is default value)
		gauge.set( nota_escalada ); // set actual value
		
		$('#log-value').html( 'average: ' + average );
		$('#log-value2').html(  'confidence: ' + confidence);
		$('#log-value3').html(  'nota escalada: ' + nota_escalada);
		$('#log-value4').html(  'max index: ' + maximum_index);
		$('#log-value5').html(  'dominant_frequency: ' + dominant_frequency.frequency);
		$('#log-value6').html(  'note: ' + dominant_frequency.note);
		
	}
}

/*
// Unnecessary addition of button to play an E note.
var note_context = new AudioContext();
var note_node = note_context.createOscillator();
var gain_node = note_context.createGain();
note_node.frequency = C2 * Math.pow(2, 4 / 12); // E, ~82.41 Hz.
gain_node.gain.value = 0;
note_node.connect(gain_node);
gain_node.connect(note_context.destination);
note_node.start();

var playing = false;
function toggle_playing_note()
{
	playing = !playing;
	if (playing)
		gain_node.gain.value = 0.1;
	else
		gain_node.gain.value = 0;
}
*/
