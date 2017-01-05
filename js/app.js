//
// Created by Sarah Koziol.
//
$(document).ready(function() {
    var config = {
        urls: {
            sparql: 'http://143.93.114.137/sparqlproxy/SPARQL',
            dpedia: 'https://dbpedia.org/sparql',
            geonames: 'http://api.geonames.org/get',
            gnd: 'http://143.93.114.137/sparqlproxy/GND',
            dnb: 'http://d-nb.info/gnd/1063654211'
        }
    };

    var query = 'SELECT * WHERE { ?s ?p ?o. } LIMIT 25';
    query = encodeURIComponent(query);
    $.ajax({
        async: false,
        dataType: 'json',
        data: {
            repo: 'annedb',
            query: query,
            format: 'json'
        },
        url: config.urls.sparql,
        error: function (jqXHR, textStatus, errorThrown) {
            alert(errorThrown);
        },
        success: function (response) {
            var bindings = response.results.bindings;
            console.info(bindings);
            console.log(bindings[0].s.value);
        }
    });
});
