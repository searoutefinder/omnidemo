let omniDemo = (function(){
	const details = {
		'apiUrl': 'https://wendyjchen.carto.com/api/v2/sql?q=',
		'apiKey': 'bf0c11b88179db6a7c5fc65166fafe9cc92b469b',
		'apiUser': 'wendyjchen',
		'densitiesTable': 'table_04x04_w_poi_densities',
		'quartilesTable': 'density_quartiles',
		'densityClusters': {},
		'clusterNames': ['Bad', 'Lower Medium', 'Upper Medium', 'Good'],
		'householdsTable': 'resident_households_with_rental_prices_and_income',
		'housesTable': 'sg_public_houses' 
	};
	let tools = {
		'carto': new carto.Client({
    		apiKey: details.apiKey,
    		username: details.apiUser
		})
	};
	let templates = {
		'sidePanelBody': document.getElementById('tpl-sidepanelbody').innerHTML,
		'densitySection': document.getElementById('tpl_poidensity').innerHTML
	};
	let vars = {
		'map': null,
		'marker': new google.maps.Marker(),
		'buildingmarker': new google.maps.Marker({
			'icon': {                             
  				'url': "http://maps.google.com/mapfiles/ms/icons/blue-dot.png"}
  			}
  		),
		'autocomplete': null,
		'source': null,
		'layer': null
	};
	function _init(){
		vars.map = new google.maps.Map(document.getElementById('map'), {
			'center': new google.maps.LatLng(1.356553, 103.829862),
			'zoom': 12,
			'mapTypeId': google.maps.MapTypeId.ROADMAP,
    		'mapTypeControlOptions': {
        		'style': google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
        		'position': google.maps.ControlPosition.TOP_RIGHT
    		},
    		'fullscreenControl': false
		});
		vars.autocomplete = new google.maps.places.Autocomplete(document.getElementById('address-input-field'), {
			'types': ['geocode']
		});
		
		vars.autocomplete.addListener('place_changed', function() {
			let place = this.getPlace();
			vars.marker.setOptions({
				'position': place.geometry.location, 
				'map': vars.map
			});
			_loadBuildingData();
		});

		document.getElementById("address-input-field").addEventListener("click", function(e){
			this.value = '';
		});	

		_fetchDataUrl(
			_createDataUrl('SELECT * FROM ' + details.quartilesTable),
			function(data){
				console.log(data);
				for(i=0;i<data.rows.length;i++){
					details.densityClusters[data.rows[i].density_column] = {};
					details.densityClusters[data.rows[i].density_column][details.clusterNames[0]] = [data.rows[i].first_split];
					details.densityClusters[data.rows[i].density_column][details.clusterNames[1]] = [data.rows[i].first_split, data.rows[i].second_split];
					details.densityClusters[data.rows[i].density_column][details.clusterNames[2]] = [data.rows[i].second_split,data.rows[i].third_split];
					details.densityClusters[data.rows[i].density_column][details.clusterNames[3]] = [data.rows[i].third_split];
				}
				console.log(details.densityClusters);
			}
		);

	    vars.source = new carto.source.SQL('SELECT * FROM ' + details.densitiesTable + ' WHERE ST_Intersects(the_geom, ST_Buffer(ST_SetSRID(ST_MakePoint(103.848201,1.371090),4326)::geography, 200))');
	    const style = new carto.style.CartoCSS('#layer {polygon-fill: #EE4D5A;polygon-opacity:0.5;line-width:0.5;line-color:#000;} #layer::labels{text-name:[density_bus_stops];text-face-name: \'Unifont Medium\';  text-size: 10;  text-fill: #FFFFFF;  text-label-position-tolerance: 0;  text-halo-radius: 2;  text-halo-fill: #4a4949;  text-dy: -10;  text-allow-overlap: true;  text-placement: interior;text-placement-type: dummy;}');
	    vars.layer = new carto.layer.Layer(vars.source, style);
	    tools.carto.addLayer(vars.layer);
	    vars.map.overlayMapTypes.push(tools.carto.getGoogleMapsMapType(vars.map));
	    vars.layer.hide();		
	}
	function _lookupBuilding(data){
	    if(data.rows.length > 0){
	    	let buildingObj = data.rows[0];
	    	var bounds = new google.maps.LatLngBounds();
	    	bounds.extend(vars.marker.getPosition());
	    	bounds.extend(new google.maps.LatLng(buildingObj.latitude, buildingObj.longitude));
	    	vars.map.fitBounds(bounds);
	    	vars.map.setCenter(new google.maps.LatLng(buildingObj.latitude, buildingObj.longitude));
	    	_mapBuilding(buildingObj);
	    	_displayBuildingData(buildingObj);
	    }		
	}
	function _lookupTransitAccess(data){
		console.log('Transit access', data);
		if(data.rows[0].count_within_400 >= 3){
			document.getElementById('bus-access').innerHTML = 'Good';
		}
		else if(data.rows[0].count_within_400 == 0){
			document.getElementById('bus-access').innerHTML = 'Bad';
		}
		if(data.rows[0].mrt_within_400 > 0){
			document.getElementById('mrt-access').innerHTML = 'Good';	
		}
		if(data.rows[0].mrt_within_400 == 0){
			document.getElementById('mrt-access').innerHTML = 'Bad';	
		}		
	}
	function _lookupDensities(data){
		let densityContainer = document.getElementById('poi-density-container');
		let densityObj = {};
		let densityAvgs = {};

		if(data.rows.length > 0){
			let fields = Object.keys(data.fields);
			let densityFields = [];
			for(i=0;i<fields.length;i++){
				if( fields[i].match(/density_.*/) ){
					densityObj[fields[i]] = [];
					densityAvgs[fields[i]] = 0;
				}
			}

			for(i=0;i<data.rows.length;i++){
				let keys = Object.keys(densityObj);
				for(j=0;j<keys.length;j++){
					densityObj[keys[j]].push(data.rows[i][keys[j]]);
				}
			}
			for(i in densityObj){
				let avgsum = 0;
				for(z=0;z<densityObj[i].length;z++){
					avgsum += densityObj[i][z];
				}
				densityAvgs[i] = {'val': parseFloat((avgsum / densityObj[i].length).toFixed(2)), 'cluster': ''};
			}
			console.log(densityObj);
			console.log(densityAvgs);
			console.log(details.densityClusters);

			
			for(s=0;s<details.clusterNames.length;s++){
				for(i in densityAvgs){
					if(typeof details.densityClusters[i] == "undefined"){continue;}
					console.log(s, details.clusterNames[s], details.densityClusters[i]);
					if( details.densityClusters[i][details.clusterNames[s]].length == 1 ){
						if(s == 0){
							//If the first array member's value is zero
							if( details.densityClusters[i][details.clusterNames[s]][0] == 0){
								//in this case the lower quartile value is zero
								densityAvgs[i].cluster = details.clusterNames[s];	
							}
							else if( details.densityClusters[i][details.clusterNames[s]][0] > 0)
							{
								//if the value of the first quartile member is greater than zero
								if(densityAvgs[i].val <= details.densityClusters[i][details.clusterNames[s]][0]){
									densityAvgs[i].cluster = details.clusterNames[s];
								}
							}
						}
						else if(s == 3){
							if(densityAvgs[i].val >= details.densityClusters[i][details.clusterNames[s]][0]){
								densityAvgs[i].cluster = details.clusterNames[s];
							}							
						}
					}
					else if( details.densityClusters[i][details.clusterNames[s]].length == 2 ){
						//Everything else
						if(densityAvgs[i].val > details.densityClusters[i][details.clusterNames[s]][0] && densityAvgs[i].val < details.densityClusters[i][details.clusterNames[s]][1]){
							densityAvgs[i].cluster = details.clusterNames[s];
						}						
					}
				}
			}

			console.log(densityAvgs);

			densityContainer.innerHTML = Mustache.render(templates.densitySection, densityAvgs);
		}
		console.log(data);
	}
	function _displayCommuterStatus(data){
		console.log('Commuter status', data);
		document.getElementById('commuter').innerHTML = data.rows[0].commuter;
	}
	function _createDataUrl(query){
		return [details.apiUrl, query, '&api_key=', details.apiKey].join('');
	}
	function _fetchDataUrl(dataUrl, callback){
		fetch(dataUrl)
			.then(function(response){
				return response.json();
			})
			.then(callback);
	}
	function _loadBuildingData(){
		
		_fetchDataUrl(
			_createDataUrl('SELECT * FROM ' + details.housesTable + ' ORDER BY ST_Distance(the_geom, ST_SetSRID(ST_MakePoint(' + vars.marker.getPosition().lng() + ',' + vars.marker.getPosition().lat() + '),4326)) LIMIT 1'),
			_lookupBuilding	
		);
	}
	function _displayBuildingData(buildingObj){
		
		let responseObj = {};

		for (var prop in buildingObj) {
			if (buildingObj.hasOwnProperty(prop)) {
				// Push each value from `obj` into `extended`
				responseObj[prop] = buildingObj[prop];
			}
		}

		const query = 'SELECT * FROM ' + details.householdsTable + ' WHERE ST_Intersects(the_geom, ST_SetSRID(ST_MakePoint(' + buildingObj.longitude + ',' + buildingObj.latitude + '),4326))';
		const queryUrl = details.apiUrl + query + '&api_key=' + details.apiKey;

		fetch(queryUrl)
			.then(function(response){
				return response.json();
			})
			.then(function(data){
			    if(data.rows.length > 0){
			    	console.log(data.rows);

					for (var prop in data.rows[0]) {
						if (data.rows[0].hasOwnProperty(prop)) {
							// Push each value from `obj` into `extended`
							responseObj[prop] = data.rows[0][prop];
						}
					}

					let mfRatioParts = responseObj.male_female_ratio.split("/");
					responseObj.mfratiom = parseFloat(mfRatioParts[0]).toFixed(1);
					responseObj.mfratiof = parseFloat(mfRatioParts[1]).toFixed(1);

					responseObj['income_1_perc'] = responseObj['income_1_perc'].toFixed(2);
					responseObj['income_2_perc'] = responseObj['income_2_perc'].toFixed(2);
					responseObj['income_3_perc'] = responseObj['income_3_perc'].toFixed(2);
					responseObj['income_4_perc'] = responseObj['income_4_perc'].toFixed(2);

					console.log(responseObj['income_1_perc']);

					responseObj['working_class_perc_male'] = parseFloat((((responseObj.male_count_20_24 + responseObj.male_count_25_29 + responseObj.male_count_30_34 + responseObj.male_count_35_39 + responseObj.male_count_40_44 + responseObj.male_count_45_49 + responseObj.male_count_50_54 + responseObj.male_count_55_59 + responseObj.male_count_60_64) / responseObj.male_count) * 100).toFixed(2));
	 				responseObj['elderly_class_perc_male'] = parseFloat((((responseObj.male_count_65_69 + responseObj.male_count_70_74 + responseObj.male_count_75_79 + responseObj.male_count_80plus)/responseObj.male_count) * 100).toFixed(2))
	 				responseObj['youth_perc_male'] = parseFloat((100 - responseObj['working_class_perc_male'] - responseObj['elderly_class_perc_male']).toFixed(2)); 
	 				responseObj['male_students_perc_10_24'] = responseObj['male_students_perc_10_24'].toFixed(2);
	 				responseObj['female_students_perc_10_24'] = responseObj['female_students_perc_10_24'].toFixed(2);
	 				responseObj['male_kids_perc_0_4'] = responseObj['male_kids_perc_0_4'].toFixed(2);
	 				responseObj['female_kids_perc_0_4'] = responseObj['female_kids_perc_0_4'].toFixed(2);

	 				//console.log(responseObj['female_kids_perc_0_4']);

					responseObj['working_class_perc_female'] = parseFloat((((responseObj.female_count_20_24 + responseObj.female_count_25_29 + responseObj.female_count_30_34 + responseObj.female_count_35_39 + responseObj.female_count_40_44 + responseObj.female_count_45_49 + responseObj.female_count_50_54 + responseObj.female_count_55_59 + responseObj.female_count_60_64) / responseObj.female_count) * 100).toFixed(2));
	 				responseObj['elderly_class_perc_female'] = parseFloat((((responseObj.female_count_65_69 + responseObj.female_count_70_74 + responseObj.female_count_75_79 + responseObj.female_count_80plus)/responseObj.female_count) * 100).toFixed(2))
	 				//responseObj['youth_perc_female'] = parseFloat((((responseObj.female_count_0_4 + responseObj.female_count_10_14 + responseObj.female_count_15_19)/responseObj.female_count)*100).toFixed(2));
	 				responseObj['youth_perc_female'] = parseFloat((100 - responseObj['working_class_perc_female'] - responseObj['elderly_class_perc_female']).toFixed(2)); 


					document.getElementById('sidepanel-body').innerHTML = Mustache.render(templates.sidePanelBody, responseObj);
			    	document.getElementById("address-input-field").style.left = "400px";
			    	document.getElementById("mySidepanel").style.width = "400px";


					_fetchDataUrl(
						_createDataUrl("WITH bus400 AS (SELECT COUNT(*) AS count_within_400 FROM sg_bus_stops WHERE ST_DistanceSphere(the_geom, ST_SetSRID(ST_MakePoint("+ responseObj.longitude +", " + responseObj.latitude + "),4326)) < 400), bus400to800 AS (SELECT COUNT(*) AS count_400_to_800 FROM sg_bus_stops WHERE ST_DistanceSphere(the_geom, ST_SetSRID(ST_MakePoint("+ responseObj.longitude +", " + responseObj.latitude + "),4326)) > 400 AND ST_DistanceSphere(the_geom, ST_SetSRID(ST_MakePoint("+ responseObj.longitude +", " + responseObj.latitude + "),4326)) < 800), mrt400 AS (SELECT COUNT(*) AS mrt_within_400 FROM sg_mrt_stations WHERE ST_DistanceSphere(the_geom, ST_SetSRID(ST_MakePoint("+ responseObj.longitude +", " + responseObj.latitude + "),4326)) < 400), mrt800 AS (SELECT COUNT(*) AS mrt_400_to_800 FROM sg_mrt_stations WHERE ST_DistanceSphere(the_geom, ST_SetSRID(ST_MakePoint("+ responseObj.longitude +", " + responseObj.latitude + "),4326)) > 400 AND ST_DistanceSphere(the_geom, ST_SetSRID(ST_MakePoint("+ responseObj.longitude +", " + responseObj.latitude + "),4326)) < 800) SELECT a.count_within_400, b.count_400_to_800, c.mrt_within_400, d.mrt_400_to_800 FROM bus400 AS a, bus400to800 AS b, mrt400 AS c, mrt800 AS d"),
						_lookupTransitAccess
					);

					_fetchDataUrl(
						_createDataUrl("SELECT CASE WHEN count(count) > 5 THEN 'No commuters' WHEN count(count) < 5 THEN 'Likely commuters' END AS commuter FROM sg_office_locations_clusters WHERE ST_DistanceSphere(the_geom, ST_SetSRID(ST_MakePoint(" + responseObj.longitude + ", " + responseObj.latitude + "),4326)) < 1000"),
						_displayCommuterStatus
					);

					_fetchDataUrl(
						_createDataUrl('SELECT * FROM ' + details.densitiesTable + ' WHERE ST_Intersects(the_geom, ST_Buffer(ST_SetSRID(ST_MakePoint('+buildingObj.longitude+','+buildingObj.latitude+'),4326)::geography, 200))'),
						_lookupDensities	
					);								    		    		
			    }
			});			

		vars.source.setQuery('SELECT * FROM ' + details.densitiesTable + ' WHERE ST_Intersects(the_geom, ST_Buffer(ST_SetSRID(ST_MakePoint('+buildingObj.longitude+','+buildingObj.latitude+'),4326)::geography, 200))')
		.catch(function(err){
			console.log(err);
		})
		//vars.layer.show();		
	}
	function _mapBuilding(buildingObj){
		vars.buildingmarker.setOptions({'map': vars.map, 'position': new google.maps.LatLng(buildingObj.latitude, buildingObj.longitude)});
	}
	return {
		init: _init
	};
})();
window.onload = function(){
	console.log('Page has been loaded. Loading Google Maps now.');
	omniDemo.init();
}