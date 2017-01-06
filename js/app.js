//
// Created by Sarah Koziol.
//
$(document).ready(function() { // Sobald das Dokument fertig geladen ist...
    // 'Globales' Konfigurations-Objekt config, um zentral die URLs anpassen zu können
    var config = {
        urls: {
            sparql: 'http://143.93.114.137/sparqlproxy/SPARQL',
            dpedia: 'https://dbpedia.org/sparql',
            geonames: 'http://api.geonames.org/findNearbyPlaceNameJSON?&username=i3obm&lang=de',
            gnd: 'http://143.93.114.137/sparqlproxy/GND'
        }
    };

    var digs = {}; // Objekt für die Grabungen
    var persons = {}; // Objekt für die Personen

    $.ajax({
        // async: false,
        dataType: 'json',
        data: {
            repo: 'annedb',
            query: encodeURIComponent('SELECT * WHERE { ?s ?p ?o. }'), // Alle Daten holen
            format: 'json'
        },
        url: config.urls.sparql,
        error: function (jqXHR, textStatus, errorThrown) {
            alert(errorThrown);
        },
        success: function (response) {
            var bindings = response.results.bindings;
            // console.info(bindings); // Genutzt zum Debuggen
            // console.log(bindings[0].s.value);

            // Filterung der Daten
            bindings.forEach(function (element, index, arr) { // Für jeden Datensatz ...
                // ... wenn das Subjekt eine Grabung ist (enthält '#G', bspw. "http://github.com/i3mainz/idarit-2016#G8")
                // und nicht die Definition von Grabung (enthält nicht '#Grabung') ...
                if (element.s.value.indexOf('#G') !== -1 &&
                    element.s.value.indexOf('#Grabung') === -1) {
                    var digId = parseInt(element.s.value.substr(element.s.value.indexOf('#G')+2), 10); // ... die ID holen, bspw. 8.
                    if (digs[digId] == undefined) { // Wenn die Grabung noch nicht in dem Grabungsobjekt vorhanden ist ...
                        digs[digId] = {}; // ... leer anlegen.
                    }
                    // Als Eigenschaft das Prädikat nach #, sprich ohne die URI davor, und als Wert das Objekt (element.o) zur Grabung hinzufügen
                    digs[digId][element.p.value.substr(element.p.value.indexOf('#')+1)] = element.o.value;

                    // Letztendlich alle Prädikate und Objekte aus den Triples in einem Knoten mit der ID sammeln
                }

                // ... das Subjekt eine Person ist (enthält '#P') ...
                // (Die Definition befindet sich nicht in den Daten, da foaf:Person)
                if (element.s.value.indexOf('#P') !== -1) {
                    var personId = element.s.value.substr(element.s.value.indexOf('#P')+2); // ... die ID holen.
                    if (persons[personId] == undefined) { // Wenn die Person noch nicht in dem Personenobjekt vorhanden ist ...
                        persons[personId] = {}; // ... leer anlegen.
                    }

                    // Die URIs der Prädikate von Person sind unterschiedlich, teils '#' teils '/' als Zeichen vor dem Keyword
                    var propName = '';
                    if (element.p.value.indexOf('#') !== -1) {
                        propName = element.p.value.substr(element.p.value.indexOf('#')+1);
                    } else {
                        propName = element.p.value.substr(element.p.value.lastIndexOf('/')+1); // e.g. for "name"
                    }

                    var value = element.o.value;
                    if (value.indexOf('#') !== -1) { // Wenn das Objekt ein '#' enthält, also eine Beziehung darstellt ...
                        value = element.o.value.substr(element.o.value.indexOf('#')+2); // ... die URI davor entfernen ...
                        // ... und wenn es 'worksAt' ist, der entsprechenden Grabung die ID der Person hinzufügen
                        if (propName === 'worksAt') {
                            value = parseInt(value, 10); // String zu Integer
                            if (digs[value] == undefined) { // Wenn die Grabung noch nicht nicht existiert ...
                                digs[value] = {}; // ... leer anlegen.
                            }
                            if (digs[value].workers == undefined) { // Wenn die Grabung noch keine Person hat ...
                                digs[value].workers = []; // ... die Eigenschaft als leeres Array anlegen.
                            }
                            // Der entsprechenden Grabung die ID der Person hinzufügen, um diese später verwenden zu können.
                            digs[value].workers.push(personId);
                        }
                    }
                    persons[personId][propName] = value; // Prädikat und Objekt zur Person hinzufügen.
                }
            });
            // console.log(digs);
            // console.log(persons);

            // Leaflet Map auf dem Element mit der ID 'map' (#map)
            var map = L.map('map');

            // Karte laden, OpenStreetMap
            L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
            }).addTo(map);

            var markers = []; // Array für die Marker der Grabungen
            Object.keys(digs).forEach(function (dig) { // Für jede Grabung ...
                var currentDig = digs[dig];

                // ... anhand der Koordinaten die geographischen Daten laden, u.a. Stadt & Land (findNearbyPlaceNameJSON)
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

                        // Wenn die Grabung zugeordnete Personen hat...
                        if (currentDig.hasOwnProperty('workers') && currentDig.workers.length > 0) {
                            popupContent += 'Arbeiter:<br><ul>';

                            // ... jede Person mit Namen (und Id) ausgeben ...
                            currentDig.workers.forEach(function(workerId, index, arr) {
                                popupContent += `<li><a href="#" class="worker" data-worker-id="${workerId}">${persons[workerId].name}</a></li>`;
                            });
                            popupContent += '</ul>';
                        } else { // ... andernfalls Meldung anzeigen.
                            popupContent += 'Kein Arbeiter gefunden.';
                        }

                        // Endlich den aktuellen Marker zur Karte hinzufügen...
                        var marker = L.marker([currentDig.lat, currentDig.lon])
                            .addTo(map)
                            .bindPopup(popupContent);
                        markers.push(marker); // ... und in das Array speichern.
                    }
                });
            });

            var markerGroup = L.featureGroup(markers); // Alle Marker in eine featureGroup ...
            map.fitBounds(markerGroup.getBounds().pad(0.2)); // ... um die Karte entsprechend anzupassen (Zoom, Position), mit Abstand
        }
    });

    // Wenn auf ein Element mit der Klasse 'worker' geklickt wird (repräsentiert jeweils eine Person) ...
    $('body').on('click', '.worker', function (event) {
        showPersonById(event.currentTarget.dataset.workerId); // ... dann diese Person anhand der ID anzeigen.
    });

    // Funktion zum Anzeigen einer Person anhand der ID
    function showPersonById(id) {
        var targetElement = $('#personInfo');
        var person = persons[id];

        var targetElementOwnInfo = targetElement.find('.ownInfo tbody').empty(); // .empty() um etwaige vorhandene Daten einer anderen Personzu entfernen
        Object.keys(person).forEach(function (prop, index, arr) { // Für jede Eigenschaft der Person ...
            targetElementOwnInfo.append(`<tr><td>${prop}</td><td>${person[prop]}</td></tr>`); // .. eine neue Tabellenzeile hinzufügen.
        });

        var targetElementGndInfo = targetElement.find('.gndInfo');
        if (person.hasOwnProperty('sameAs')) { // Wenn die Person die Eigenschaft 'sameAs' besitzt ...
            // ... Daten von DNB (GND) laden ...
            $.ajax({
                url: config.urls.gnd,
                dataType: 'json',
                data: {
                    uri: person.sameAs // In 'sameAs' befindet sich die URI zum Eintrag
                },
                error: function(jqXHR, textStatus, errorThrown) {
                    alert(errorThrown);
                },
                success: function(response) {
                    var gndEntries = response[person.sameAs];
                    // console.log(gndEntries);
                    var targetElementGndInfoBody = targetElementGndInfo.find('tbody').empty(); // .empty() um etwaige vorhandene Daten einer anderen Personzu entfernen

                    // (Falls vorher eine Person ohne 'sameAs' angezeigt wurde,) sicherstellen dass ...
                    targetElementGndInfo.find('table').show(); // die Tabelle angezeigt ist
                    targetElementGndInfo.find('.no-info').hide(); // die Meldung ausgeblendet ist
                    Object.keys(gndEntries).forEach(function (gndEntry, index, arr) { // Für jede Eigenschaft die der GND-Eintrag besitzt ...
                        var outputValue = '';
                        gndEntries[gndEntry].forEach(function (valueObj, index, arr) { // (die Werte-Knoten sind Arrays, daher für jeden Knoten...
                            outputValue += valueObj.value + '<br>'; // ... den Wert zur Ausgabe hinzufügen)
                        });
                        targetElementGndInfoBody.append(`<tr><td>${gndEntry}</td><td>${outputValue}</td></tr>`); // .. eine neue Tabellenzeile hinzufügen.
                    });
                }
            });
        } else { // ... andernfalls Meldung anzeigen.
            targetElementGndInfo.find('table').hide();
            targetElementGndInfo.find('.no-info').show();
        }

        var targetElementDbpediaInfo = targetElement.find('.dbpediaInfo');
        if (person.hasOwnProperty('seeAlso')) { // Wenn die Person die Eigenschaft 'seeAlso' besitzt ...
            // Query zum Laden
            var query = 'SELECT * WHERE { ?s ?p ?o. FILTER (?s=<' + person.seeAlso +'>) } LIMIT 100'; // Auf 100 Einträge limitiert aufgrund der Dauer
            // Daten von DBpedia laden
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
                    var targetElementDbpediaInfoBody = targetElementDbpediaInfo.find('tbody').empty();

                    targetElementDbpediaInfo.find('table').show();
                    targetElementDbpediaInfo.find('.no-info').hide();
                    bindings.forEach(function (binding, index, arr) { // Für jede Eigenschaft die der DBpedia-Eintrag besitzt ...
                        // Das Subjekt (binding.s) ist gleichbleibend die Person, die angefragt wurde, daher keine Ausgabe
                        targetElementDbpediaInfoBody.append(`<tr><td>${binding.p.value}</td><td>${binding.o.value}</td></tr>`) // .. eine neue Tabellenzeile hinzufügen.
                    });
                }
            });
        } else { // ... andernfalls Meldung anzeigen
            targetElementDbpediaInfo.find('table').hide();
            targetElementDbpediaInfo.find('.no-info').show();
        }

        // Schlussendlich (beim ersten Anzeigen einer Person) die verschiedenen Einträge anzeigen und Meldung über keine Person ausblenden
        targetElement.find('.hidden').removeClass('hidden');
        targetElement.find('.no-person').addClass('hidden');
    }
});
