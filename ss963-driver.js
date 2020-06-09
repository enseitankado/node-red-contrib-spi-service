module.exports = function(RED) {

	// Can't use undeclared variables for clean code
	"use strict";

    function ss963ConfigNode(n) {
        RED.nodes.createNode(this, n);
        this.configLabel = n.configLabel;
        this.portCount = n.portCount;
        this.latchPin = n.latchPin;
        this.latchDelay = n.latchDelay;
        this.speed = n.speed;
        this.loopDelayUs = n.loopDelayUs;
    }
    RED.nodes.registerType('ss963-config', ss963ConfigNode);

	/*
		---------------------------------------------------------------
	*/
    function driverNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;
		node.configNode = RED.nodes.getNode(config.configName);

		// Check Raspberry Pi Hardware
/*
		var isPi = require('detect-rpi');
		if (!isPi()
			node.error("detect-rpi: The ss963-driver node requires Raspberry Pi but could not detect Raspberry Pi Hardware.");
*/
		// Check SPI Enabled
		const fs = require('fs')
		if (!fs.existsSync('/dev/spidev0.0'))
			node.error("SPI port is not enabled!");

		// Check SHM Listener Service

		const { exec } = require("child_process");
		exec("sudo systemctl status apache2 | grep active",
			(error, stdout, stderr) => {
				if (!stdout.includes("Active: active (running)"))
					node.error("SHM Listener driver not loaded.");
			});



//		node.portCount = configNode.portCount;
//    	node.latchPin = configNode.latchPin;
//    	node.latchDelay = configNode.latchDelay;
//		node.status( {fill:"red", shape:"dot", text: node.portCount+"-"+node.latchPin+"-"+node.latchDelay} );

//        var configNode = RED.nodes.node(config.configLabel);


        node.on('input', function(msg) {

			try {
		        node.status({ fill:"red", shape:"dot", text: node.configNode.portCount});
				// Array.isArray(msg.payload))

			} catch (error) {

                node.status( {fill:"red", shape:"dot", text:error.message} );
                node.error(error.message);
                throw(error);

			} finally {
	            node.send(msg);
			}
        });
    }
    RED.nodes.registerType("ss963-driver", driverNode);
}
