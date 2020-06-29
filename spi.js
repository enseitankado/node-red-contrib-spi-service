module.exports = function(RED) {

	// Can't use undeclared variables for clean code
	"use strict";

	const NODE_NAME = 'SPI Service';

	/*
		---------------------------------------------------------------
	*/
    function driverNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;

		is_raspberry();
		is_spi_exists();
		is_service_running();

		node.portCount = Number(config.portCount);
		node.latchPin = Number(config.latchPin);
		node.latchDelay = Number(config.latchDelay);
		node.speed = Number(config.speed);
		node.loopDelayUs = Number(config.loopDelayUs);
		node.disableSHMWriteBack = Number(config.disableSHMWriteBack);
		node.shmSegmentKey = Number(config.shmSegmentKey);

		// -------------------------------------------
		node.on('input', function(msg) {

            const path = require("path");
            const shm = require(path.resolve(__dirname, "node_modules/shm-typed-array/index.js"));
            var SHM; // SHM pointer

			try {
				var SHM_size = Math.ceil(node.portCount/8);

				// Attach array to SHM
				SHM = shm.create(SHM_size, 'Uint8Array', node.shmSegmentKey);

				// reverse ports and bits
				let decimalArr = convert_payload_array_to_shm_array(msg.payload, SHM_size);
				// Write to SHM
				for (let i=0; i<SHM_size; i++)
					SHM[i] = decimalArr[i];

				//Wait for service to update shm if miso write back is enabled
				if (0 == node.disableSHMWriteBack)
					sleep(10);

				// Read-back SHM
				// Issue: https://github.com/ukrbublik/shm-typed-array/issues/10
				SHM = shm.get(node.shmSegmentKey, 'Uint8Array');

				// Output MISO input
				let payloadArr = convert_shm_array_to_payload_array(SHM, SHM_size);
                for (let i=0; i<node.portCount; i++)
                    msg.payload[i] = payloadArr[i];

			} catch (error) {
                node.status( {fill:"red", shape:"dot", text: error.message} );
                node.error(error.message);
                throw(error);

			} finally {
	            node.send(msg);
				shm.detach(node.shmSegmentKey);
			}
        });

        // -------------------------------------------
        node.on('close', function() {
            RED.log.info(NODE_NAME + ': Node closed.');
            RED.comms.publish('A message to admin for next relasess alarm.');
        });


function sleep(milliseconds) {
  const date = Date.now();
  let currentDate = null;
  do {
    currentDate = Date.now();
  } while (currentDate - date < milliseconds);
}



		// -------------------------------------------
        function convert_shm_array_to_payload_array(SHM_arr, SHM_size) {

			var binArr = [];
			binArr.length = SHM_size * 8;
			var i = 0, octal, dec, bits;
			for (dec = 0; dec < SHM_size; dec++) {
				octal = SHM_arr[dec];
				for (bits = 0; bits < 8; bits++) {
                  binArr[i] = (octal & Math.pow(2, bits)) >>> bits;
                  i++;
               }
			}
			binArr = binArr.reverse();
			return binArr;
        }

		// -----------------------------------------------------------
		// Convert binary presented payload array to new decimal array
		function convert_payload_array_to_shm_array(payload_arr, SHM_size) {

            var i = 0;
			var retArr = new Array(SHM_size);
			payload_arr = payload_arr.reverse();

            for (var dec = 0; dec < SHM_size; dec++) {
               var octal = 0;
               for (var bits = 7; bits >=0; bits--) {
                  octal += payload_arr[i] * Math.pow(2, bits);
                  i++;
               }
               retArr[dec] = reverseBits(octal);
            }
			return retArr;
		}

        // Convert bin(00000001) to dec(128) = bin(10000000)
        function reverseBits(x) {
           var binStrArr = parseInt(x, 10).toString(2).split("");
           var addZero = 8-binStrArr.length;
           for (var i=0; i<addZero; i++)
              binStrArr.unshift(0);
           return parseInt(binStrArr.reverse().join(""), 2);
        }

		// ----------------------------------------------------------
		function  is_raspberry() {
	        // Check Raspberry Pi Hardware
	        var isPi = require('detect-rpi');
	        if (!isPi())
	            node.error("This is Raspberry Pi specific node.");
		}

		function is_spi_exists() {
	        // Check SPI Enabled
	        const fs = require('fs')
    	    if (!fs.existsSync('/dev/spidev0.0'))
	            node.error("There is no SPI port!");
		}

		function is_service_running() {
	        // Check SHM Listener Service
	        const { exec } = require("child_process");
	        exec("sudo systemctl status spi.service | grep active",
	            (error, stdout, stderr) => {

	                if (!stdout.includes("Active: active (running)")) {
	                    node.error("SHM Listener driver not loaded.");
	                    node.status( {fill:"red", shape:"dot", text: "Service is not runnig!"} );
	                } else {
	                    node.status( {fill:"green", shape:"dot", text: "Service is running"} );
					}
    	        });
		}

		// -------------------------------------------------
        RED.httpAdmin.get("/saveServiceConfFile", RED.auth.needsPermission('spi-service.write'), function(req, res) {

			try {

				const fs = require('fs');
				const ini = require('ini');
				const path = require("path");

				var config = {
					PORT_COUNT: 	Number(req.query.PORT_COUNT) ,
	                LATCH_PIN: 		Number(req.query.LATCH_PIN),
	                LATCH_DELAY: 	Number(req.query.LATCH_DELAY),
	                SPEED: 			Number(req.query.SPEED),
	                LOOP_DELAY_US: 	Number(req.query.LOOP_DELAY_US),
					DISABLE_SHM_WRITE_BACK: Number(req.query.DISABLE_SHM_WRITE_BACK),
					SHM_SEGMENT_KEY: Number(req.query.SHM_SEGMENT_KEY)
				}
				fs.writeFileSync(path.resolve(__dirname, "spi.service.conf"), ini.stringify(config, {}));
				const { exec } = require("child_process");

				exec("sudo mv " + path.resolve(__dirname, "spi.service.conf") + " /etc/spi.service.conf", (error, stdout, stderr) => {
					node.log(stderr);
				});

				exec("sudo systemctl restart spi.service",  (error, stdout, stderr) => {
    	            node.log(stderr);
	            });

				node.status( {fill:"red", shape:"ring", text: "Please deploy."} );
				res.sendStatus(200);

			} catch(err) {
				//res.json({ status: 'success' });
				res.sendStatus(500);
				addminNode.error(RED._("spi-service: /saveServiceConfFile API failed.",{error:err.toString()}));
			}

        });

		// -------------------------------------------------
        RED.httpAdmin.get("/getServiceConfFile", RED.auth.needsPermission('spi-service.read'), function(req, res) {
            const fs = require('fs');
            const ini = require('ini');
            const path = require("path");
    	    res.json(ini.parse(fs.readFileSync(path.resolve(__dirname, "/etc/spi.service.conf"), 'utf-8')));
        });

    }
    RED.nodes.registerType("spi-service", driverNode);
}
