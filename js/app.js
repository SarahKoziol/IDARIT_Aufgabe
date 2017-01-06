//
// Created by Sarah Koziol.
//
$(document).ready(function() {
    var config = {
        urls: {
            sparql: 'http://143.93.114.137/sparqlproxy/SPARQL',
            dpedia: 'https://dbpedia.org/sparql',
            geonames: 'http://api.geonames.org/findNearbyPlaceNameJSON?&username=i3obm&lang=de',
            gnd: 'http://143.93.114.137/sparqlproxy/GND'
        }
    };

    var digs = {};
    var persons = {};

    $.ajax({
        // async: false,
        dataType: 'json',
        data: {
            repo: 'annedb',
            query: encodeURIComponent('SELECT * WHERE { ?s ?p ?o. }'),
            format: 'json'
        },
        url: config.urls.sparql,
        error: function (jqXHR, textStatus, errorThrown) {
            alert(errorThrown);
        },
        success: function (response) {
            var bindings = response.results.bindings;
            // console.info(bindings);
            // console.log(bindings[0].s.value);
            bindings.forEach(function (element, index, arr) {
                if (element.s.value.indexOf('#G') !== -1 && element.s.value.indexOf('#Grabung') === -1) {
                    var digId = parseInt(element.s.value.substr(element.s.value.indexOf('#G')+2), 10);
                    if (digs[digId] == undefined) {
                        digs[digId] = {};
                    }
                    // TODO handle duplicate props, e.g. visitedBy
                    digs[digId][element.p.value.substr(element.p.value.indexOf('#')+1)] = element.o.value;
                }

                if (element.s.value.indexOf('#P') !== -1) {
                    var personId = element.s.value.substr(element.s.value.indexOf('#P')+2);
                    if (persons[personId] == undefined) {
                        persons[personId] = {};
                    }
                    var propName = '';
                    if (element.p.value.indexOf('#') !== -1) {
                        propName = element.p.value.substr(element.p.value.indexOf('#')+1);
                    } else {
                        propName = element.p.value.substr(element.p.value.lastIndexOf('/')+1); // e.g. for "name"
                    }
                    var value = element.o.value;
                    if (value.indexOf('#') !== -1) {
                        value = element.o.value.substr(element.o.value.indexOf('#')+2);
                        if (propName === 'worksAt') {
                            value = parseInt(value, 10);
                            if (digs[value] == undefined) {
                                digs[value] = {};
                            }
                            if (digs[value].workers == undefined) {
                                digs[value].workers = [];
                            }
                            digs[value].workers.push(personId);
                        }
                    }
                    persons[personId][propName] = value;
                }
            });
            // console.log(digs);
            console.log(persons);

            var map = L.map('map');

            L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
            }).addTo(map);

            var markers = [];
            Object.keys(digs).forEach(function (dig) {
                var currentDig = digs[dig];
                
                $.ajax({
                    async: false,
                    url: config.urls.geonames,
                    data: {
                        lat: currentDig.lat,
                        lng: currentDig.lon
                    },
                    error: function(jqXHR, textStatus, errorThrown) {
                        alert(errorThrown);
                    },
                    success: function(response) {
                        // console.log(response);
                        var geonameObj = response.geonames[0];
                        var popupContent = `Grabung #${dig} "${currentDig.label}" @ ${currentDig.lat}, ${currentDig.lon}<br>
                                            in ${geonameObj.name}, ${geonameObj.adminName1}, ${geonameObj.countryName}.<br>`;
                        if (currentDig.hasOwnProperty('workers') && currentDig.workers.length > 0) {
                            popupContent += 'Arbeiter:<br><ul>';
                            currentDig.workers.forEach(function(workerId, index, arr) {
                                popupContent += `<li><a href="#" class="worker" data-worker-id="${workerId}">${persons[workerId].name}</a></li>`;
                            });
                            popupContent += '</ul>';
                        } else {
                            popupContent += 'Kein Arbeiter gefunden.';
                        }
                        var marker = L.marker([currentDig.lat, currentDig.lon])
                            .addTo(map)
                            .bindPopup(popupContent);
                        markers.push(marker);
                    }
                });
            });

            var markerGroup = L.featureGroup(markers);
            map.fitBounds(markerGroup.getBounds().pad(0.2));
        }
    });

    $('body').on('click', '.worker', function (event) {
        showPersonById(event.currentTarget.dataset.workerId);
    });

    function showPersonById(id) {
        // console.log(id);
        var targetElement = $('#personInfo');
        var person = persons[id];

        var targetElementOwnInfo = targetElement.find('.ownInfo');
        Object.keys(person).forEach(function (prop, index, arr) {
            targetElementOwnInfo.append(`<p>${prop}: ${person[prop]}</p>`);
        });

        if (person.hasOwnProperty('sameAs')) {
            var targetElementGndInfo = targetElement.find('.gndInfo');
            $.ajax({
                url: config.urls.gnd,
                dataType: 'json',
                data: {
                    uri: person.sameAs
                },
                error: function(jqXHR, textStatus, errorThrown) {
                    alert(errorThrown);
                },
                success: function(response) {
                    console.info(response);
                    var object = response[person.sameAs];
                    console.log(object['http://d-nb.info/standards/elementset/gnd#preferredNameForThePerson'][0].value);
                    // targetElementGndInfo.text(object);
                }
            });
        }

        if (person.hasOwnProperty('seeAlso')) {
            var query = 'SELECT * WHERE { ?s ?p ?o. FILTER (?s=<' + person.seeAlso +'>) } LIMIT 100'; // TODO increase/remove limit?
            var targetElementDbpediaInfo = targetElement.find('.dbpediaInfo');
            $.ajax({
                url: config.urls.dpedia,
                dataType: 'json',
                data: {
                    'default-graph-uri': 'http://dbpedia.org',
                    'query': query,
                    'format': 'application/sparql-results+json'
                },
                error: function(jqXHR, textStatus, errorThrown) {
                    alert(errorThrown);
                },
                success: function(response) {
                    var bindings = response.results.bindings;
                    // console.info(bindings);
                    // console.log(bindings[0].s.value);
                    bindings.forEach(function (binding, index, arr) {
                        targetElementDbpediaInfo.append(`<p>${binding.p.value} - ${binding.o.value}</p>`)
                    });
                }
            });
        }
    }

    function renderTable (target, s, p, o) {

    }
});
