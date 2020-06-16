module.exports = function(RED) {

	// Can't use undeclared variables for clean code
//	"use strict";

	const NODE_NAME = 'SPI Service Node';

	/*
		---------------------------------------------------------------
	*/
    function driverNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;

		is_raspberry();
		is_spi_exists();
		is_service_running();;

		node.portCount = config.portCount;
		node.latchPin = config.latchPin;
		node.latchDelay = config.latchDelay;
		node.speed = config.speed;
		node.loopDelayUs = config.loopDelayUs;

node.error("testtttt-111111");

		// -------------------------------------------
		node.on('input', function(msg) {

node.error("testtttt");

            const path = require("path");
            const shm = require(path.resolve(__dirname, "node_modules/shm-typed-array/index.js"));
            var SHM_arr, SHM_SEGMET_KEY = 1000146;

			try {

node.log(node.portCount);
node.log(Math.ceil(node.portCount/8));

				var SHM_size = Math.ceil(node.portCount/8);
				SHM_arr = shm.create(SHM_size, 'Uint8Array', SHM_SEGMET_KEY);

				node.log(msg.payload[1]);

				SHM_arr[0] = Math.floor(Math.random() * 255);
				SHM_arr[1] = Math.floor(Math.random() * 255);



				SHM_arr = shm.get(SHM_SEGMET_KEY, 'Uint8Array');
				node.log(SHM_arr);


			} catch (error) {
                node.status( {fill:"red", shape:"dot", text:error.message} );
                node.error(error.message);
                throw(error);

			} finally {
	            node.send(msg);
				node.done();
				shm.detach(SHM_SEGMET_KEY);
			}
        });

        // -------------------------------------------
        node.on('close', function() {
            RED.log.info(NODE_NAME + ': Node closed.');
            RED.comms.publish('A message to admin');
        });

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
	                } else
	                    node.status( {fill:"green", shape:"dot", text: "Service is runnig"} );
    	        });
		}

		// -------------------------------------------------
        RED.httpAdmin.get("/saveServiceConfFile", RED.auth.needsPermission('SPIService.write'), function(req, res) {

			const fs = require('fs');
			const ini = require('ini');
			const path = require("path");

			var config = {
				PORT_COUNT: req.query.PORT_COUNT ,
                LATCH_PIN: req.query.LATCH_PIN,
                LATCH_DELAY: req.query.LATCH_DELAY,
                SPEED: req.query.SPEED,
                LOOP_DELAY_US: req.query.LOOP_DELAY_US
			}
			fs.writeFileSync(path.resolve(__dirname, "spi.service.conf"), ini.stringify(config, {}))
			const { exec } = require("child_process");
			exec("sudo mv " + path.resolve(__dirname, "spi.service.conf") + " /etc/spi.service.conf", (error, stdout, stderr) => {
				node.log(stderr);
			});
			exec("sudo systemctl restart spi.service");
			node.status( {fill:"blue", shape:"ring", text: "Service restarted."} );
        });

		// -------------------------------------------------
        RED.httpAdmin.get("/getServiceConfFile", RED.auth.needsPermission('SPIService.read'), function(req, res) {

            const fs = require('fs');
            const ini = require('ini');
            const path = require("path");
    	    res.json(ini.parse(fs.readFileSync(path.resolve(__dirname, "/etc/spi.service.conf"), 'utf-8')));
        });

    }
    RED.nodes.registerType("ss963-driver", driverNode);
}
