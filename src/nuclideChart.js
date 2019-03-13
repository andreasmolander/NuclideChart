/*
NUCLIDE CHART

The nc function handles the nuclide chart.
To use this, make sure d3.js is available (only tested with v5).

The CSS id's and class names given to the chart content is declared in the beginning of the nc function.

Usage:

nc.nuclideId(d)
    Gets the nuclide id of a nuclide. d should be a JSON object "implementing" the C# class SerializableYield.

nc.verifyData(data)
    Returns true if data is ok, otherwise false.

    data should be a JSON object cointaining the data of the nuclides.
    The nuclide content of this data should "implement" the C# class ChartNuclide, which serves as an "interface"
    for the information used in this chart.

nc.yieldChart(chartContainer, legendContainer)
    Initializes a nuclide chart in chartContainer with a legend in legendContainer.

nc.yieldChart().addNavigationButtons(buttonContainer)
    Adds navigation buttons in container.

nc.yieldChart().disableNavigationButtons()
    Disables the navigation buttons.

nc.yieldChart().enableNavigationButtons()
    Enables the navigation buttons.

nc.yieldChart().draw(data, compare)
    Draws the nuclide chart from data. If compare is true, use settings for comparing yields.

    data should be a JSON object cointaining the data of the nuclides.
    The nuclide content of this data should "implement" the C# class ChartNuclide, which serves as an "interface"
    for the information used in this chart.

    To draw additional stuff, like yields and decay modes, data "implementing" the C# class YieldChartNuclide can be used.

nc.yieldChart().clear()
    Clears the nuclide chart.

nc.yieldChart().notify(message)
    Clears the nuclide chart and shows a notification message.

nc.yieldChart().zoom(x)
    Zooms the nuclide chart by a factor x.
    
nc.yieldChart().transform(x, y)
    Transforms the nuclide chart by x nuclides horizontally and y nuclides vertically.

nc.yieldChart().goToNuclide(input)
    Parses the input to a valid nuclide id. Transforms the nuclide chart to show the nuclide with the parsed id.
    If the nuclide is found, return the id (in the format "He4").

nc.yieldChart().setDecayModeVisibility(visible)
    visible = bool

nc.yieldChart().setMagicNumberVisibility(visible)
    visible = bool
*/

var nc = new function () {

    var self = this;

    var chartDivId = "ncChartDiv";
    var chartNotifyTextId = "ncCartNotificationText"
    var chartButtonClass = "ncChartButton";
    var legendDivClass = "ncLegendDiv";
    var legendAxisClass = "ncLegendAxis";
    var legendGradientId = "ncLegendGradient";
    var decayModeLegendColorClass = "ncDecayModeLegendColor";
    var legendTickClass = "ncLegendTick";
    var halfLifeClass = "ncHalfLife";
    var decayModeClass = "ncDecayMode";
    var magicNumberClass = "ncMagicNumber"
    var chartAxisClass = "ncChartAxis";
    var nuclideSVGId = "ncNuclideSVG";

    // em size in pixels
    // Todo (Andreas Molander 23.07.2018): Drop this and use pixels everywhere?
    var em = 16;

    // Chart design parameters
    var nuclideSize = 64;
    var nuclidePadding = 0;
    var magicNumbers = [2, 8, 20, 28, 50, 82, 126];

    function getSize(element) {
        // Get the size of a DOM element
        return {
            width: element.getBoundingClientRect().width,
            height: element.getBoundingClientRect().height
        }
    }

    /* Functions for getting nuclide properties needed for the chart */
    function nuclideXPos(d) {
        return (d.A - d.Z) * (nuclideSize + nuclidePadding);
    }

    function nuclideYPos(d) {
        return -(d.Z * (nuclideSize + nuclidePadding));
    }

    function nuclideName(d) {
        var name = d.Symbol || "noname"
        return name.trim() + " " + (d.A);
    }

    function nuclideStringToId(input) {
        // Parse the input to a valid nuclide DOM-element id
        var numReg = /\d+/;
        var symbolReg = /[A-Za-z]+/;
        var id = input.match(symbolReg) +input.match(numReg);
        return id.charAt(0).toUpperCase() +id.slice(1);
    }

    function formatYield(n, unit) {
        if (n.Yield) {
            if (unit == "ratio") {
                // Return the yield ratio as a 2 decimal number

                // If the yield ratio is a divide by zero, the calculation will return -1
            if (n.Yield == - 1) return "undefined";
            return n.Yield.toFixed(2);
            }
            return n.Yield.toExponential(2);
        } else {
            return "";
        }
    }

    function formatLegendYield(y, unit) {
        // Format the yields or yield ratios shown on the legend axis.
        // E.g. since the scale is logarithmic, 0 can't be used as domain value, but it's nicer to show
        // 0 instead of 10^(-5) that is used as a approximation for 0.
        if (unit == "ratio") {
            return y == 0.00001 ? "0" : y == 1 ? "1/1" : y == 100 ? "≥ 100/1" : "";
        } else if (unit == "yields") {
            return y == 0.00001 ? 0 : y.toExponential(0);
        }
        return y.toExponential(0);
    }

    function getMagicNumbers(data, magicNumbers) {
        // Get the magic numbers with the min/max Z and N values (limits) of the yields for each magic number.
        // The limits are needed for limiting the lines around the chart and not filling up the whole SVG area.
        var mNrArray = [];
        var max = 1000;
        var min = -1000;

        // Initialize the objects
        for (var i = 0; i < magicNumbers.length; i++) {
            mNrArray.push({ nr: magicNumbers[i], limits: { minZ: max, maxZ: min, minN: max, maxN: min} });
        }

        // Iterate through the yields
        $.each(data, function (i, v) {
            var z = v.Z;
            var n = v.A - v.Z;

            // Assign the limit values
            for (var i = 0; i < mNrArray.length; i++) {
                var mNr = mNrArray[i];
                if (Math.abs(mNr.nr - n) <= 1) {
                    if (z < mNr.limits.minZ) mNr.limits.minZ = z;
                    if (z > mNr.limits.maxZ) mNr.limits.maxZ = z;
                }
                if (Math.abs(mNr.nr - z) <= 1) {
                    if (n < mNr.limits.minN) mNr.limits.minN = n;
                    if (n > mNr.limits.maxN) mNr.limits.maxN = n;
                }
            }
        });

        return mNrArray;
    }

    self.nuclideId = function (d) {
        // Gets the nuclide id of a nuclide. d should be a JSON object "implementing" the C# class ChartNuclide.
        var name = d.Symbol || "noname";
        return name.trim() + d.A;
    }

    self.verifyData = function (data) {
        /*
        Returns true if data is ok, otherwise false.

        data should be a JSON object cointaining the data of the nuclides.
        The nuclide content of this data should "implement" the C# class ChartNuclide, which serves as an "interface"
        for the information used in this chart.
        
        Todo (Andreas Molander 26.07.2018): Add more checks?
         */
        if ($.isEmptyObject(data)) {
            return false;
        } else {
            return true;
        }
    }

    self.nuclideChart = function (chartContainer, legendContainer) {
        return new function () {
            // Initializes a nuclide chart in chartContainer with a legend in legendContainer.
            var selfChart = this;
            var chartDiv = d3.select(chartContainer);
            var legendDiv = d3.select(legendContainer);
            var zoom;
            var notificationText = chartDiv.append("span")
                .attr("id", chartNotifyTextId)
                .style("display", "none");

            var nuclideFill = function (d) {
                return "transparent";
            }

            function removeNotification() {
                notificationText.text("").style("display", "none");
            }

            this.clear = function () {
                // Clears the nuclide chart.

                removeNotification();
                function clearLegend() {
                    legendDiv.selectAll("span").remove();
                    legendDiv.selectAll("div").remove();
                }

                d3.select("#" + chartDivId).remove();

                clearLegend();
            }

            this.notify = function (message) {
                // Remove the chart and show a notification message
                this.clear();

                var chartNotificationTextY = getSize(chartDiv.node()).height / 2;
                notificationText
                    .text(message)
                    .style("display", "block")
                    .style("margin-top", chartNotificationTextY + "px");
            }

            this.zoomBy = function (x) {
                // Zoom the chart by a factor x
                if (zoom) {
                    d3.select("#" + nuclideSVGId).transition().duration(1000).call(zoom.scaleBy, x);
                }
            }

            this.transform = function (x, y) {
                // Transform the chart by (x, y) * nuclideSize
                // Todo (Anreas Molander 05.07.2018): Disable scaling (zooming)
                if (zoom) {
                    d3.select("#" + nuclideSVGId)
                        .transition()
                        .duration(1000)
                        .call(zoom.translateBy, x * nuclideSize, y * nuclideSize);
                }
            }

            this.goToNuclide = function (input) {
                // Parses the input to a valid nuclide id. Transforms the nuclide chart to show the nuclide
                // with the parsed id.
                // If the nuclide is found, return the id (in the format "He4").

                var nuclideId = nuclideStringToId(input);

                // Transform the chart to the coordinates (x,y)
                function trans(x, y) {
                    var width = getSize(d3.select("#" + nuclideSVGId).node()).width;
                    var height = getSize(d3.select("#" + nuclideSVGId).node()).height;
                    return d3.zoomIdentity
                        .translate((-x + (width / 2) - (nuclideSize / 2)),
                                    (-y + (height / 2) - (nuclideSize / 2)))
                        .scale(1);
                }

                if (nuclideId) {
                    var nuclide = d3.select("#" + nuclideId);
                    if (nuclide.node()) {
                        var rect = nuclide.select("rect");
                        var x = rect.attr("x");
                        var y = rect.attr("y");
                        d3.select("#" + nuclideSVGId).transition()
                            .duration(4000)
                            .call(zoom.transform, function () { return trans(x, y) });
                        return nuclideId;
                    }
                }
            }

            this.setDecayModeVisibility = function (visible) {
                var attribute = visible ? null : "none";
                d3.selectAll("." + decayModeClass).style("display", attribute);
            }

            this.setMagicNumberVisibility = function (visible) {
                var attribute = visible ? null : "none";
                d3.selectAll("." + magicNumberClass).style("display", attribute);
            }

            this.addNavigationButtons = function (buttonContainer) {
                // Add chart navigation buttons
                var buttonDiv = d3.select(buttonContainer);

                // Zoom in
                buttonDiv.append("input")
                    .attr("type", "button")
                    .classed(chartButtonClass, true)
                    .attr("value", "+")
                    .on("click", function () { selfChart.zoomBy(2); });

                // Zoom out
                buttonDiv.append("input")
                    .attr("type", "button")
                    .classed(chartButtonClass, true)
                    .attr("value", "-")
                    .on("click", function () { selfChart.zoomBy(0.5); });

                // Move up
                buttonDiv.append("input")
                    .attr("type", "button")
                    .classed(chartButtonClass, true)
                    .attr("value", "\u21E7")
                    .on("click", function () { selfChart.transform(0, 5); });

                // Move left
                buttonDiv.append("input")
                    .attr("type", "button")
                    .classed(chartButtonClass, true)
                    .attr("value", "\u21E6")
                    .on("click", function () { return selfChart.transform(5, 0); });

                // Move down
                buttonDiv.append("input")
                    .attr("type", "button")
                    .classed(chartButtonClass, true)
                    .attr("value", "\u21E9")
                    .on("click", function () { return selfChart.transform(0, -5); });

                // Move right
                buttonDiv.append("input")
                    .attr("type", "button")
                    .attr("id", "rightButton")
                    .classed(chartButtonClass, true)
                    .attr("value", "\u21E8")
                    .on("click", function () { return selfChart.transform(-5, 0); });
            }

            this.disableNavigationButtons = function () {
                d3.selectAll("." + chartButtonClass).attr("disabled", "disabled");
            }

            this.enableNavigationButtons = function () {
                d3.selectAll("." + chartButtonClass).attr("disabled", null);
            }

            this.draw = function (data, compare, showDecayModes, showMagicNumberLines, yields) {
                // Draw the chart

                this.clear();

                // Check if yields are provided
                var isThereYields = $.grep(data, function (n) {
                    return n.Yield != null;
                }).length > 0;

                // Check if decay modes are provided
                var isThereDecayModes = $.grep(data, function (n) {
                    return n.DecayMode != null;
                }).length > 0;

                // Get the largest Z and N values of the yield data
                var largestN = d3.max(data, function (d) { return d.A - d.Z });
                var largestZ = d3.max(data, function (d) { return d.Z; });

                /* Create d3 scales for the Z/N ranges */
                var x = d3.scaleLinear()
                    .domain([-0.5, largestN - 0.5])
                    .range([0, largestN * nuclideSize]);

                var y = d3.scaleLinear()
                    .domain([+0.5, -largestZ + 0.5])
                    .range([0, largestZ * nuclideSize]);

                /* Create d3 axes for the Z/N ranges*/
                // Todo (Andreas Molander 10.07.2018): Show only one tick per N or Z
                var xAxis = d3.axisBottom(x)
                    .ticks(largestN)
                    .tickFormat(d3.format("d"));

                var yAxis = d3.axisRight(y)
                    .ticks(largestZ)
                    .tickFormat(d3.format("d"));

                /* Create the yield color scale if yields are provided */
                if (isThereYields) {
                    var maxYield = d3.max(data, function (d) { return d.Yield; });
                    var yieldDomain = compare ? [0.01, 100] : [1, maxYield];

                    // Color range: blue, cyan, green, yellow, red
                    var colorRange = ["#0000FF", "#44FFFF", "#00FF00", "#FFFF00", "#FF0000"];
                    var nColors = colorRange.length;

                    // This is an arbitrary range, it can be whatever,
                    // but the range will be used as the height of the legend in pixels
                    var legendRange = [0, 100];


                    var scale = d3.scaleLog().domain(yieldDomain).range(legendRange);

                    var step = (d3.max(legendRange) - d3.min(legendRange)) / (nColors - 1);
                    var legendRangeValue = d3.range(nColors).map(function (d) { return d3.min(legendRange) + d * step; });
                    var colorValues = legendRangeValue.map(scale.invert);
                    var colorScale = d3.scaleLog().domain(colorValues).range(colorRange);
                }

                // Decay modes
                var decayModeColors = {
                    'is': '#000000',
                    'b-': '#62aeff',
                    '2b-': '#62aeff',
                    'b+': '#ff7e75',
                    'ec': '#ff7e75',
                    '2ec': '#ff7e75',
                    'a': '#fffe49',
                    'sf': '#5cbc57',
                    'p': '#ffa425',
                    '2p': '#ffa425',
                    'n': '#9fd7ff',
                    '2n': '#9fd7ff',
                    'it': '#ffffff',
                    'cluster': '#a564cc',
                    '?': '#cccccc'
                }

                var decayModeColors2 = [
                    { mode: '\u03B1 emission', modeShort: "a", color: '#fffe49' },
                    { mode: 'proton emission', modeShort: "p", color: '#ffa425' },
                    { mode: '2-proton emission', modeShort: "2p", color: '#ffa425' },
                    { mode: 'neutron emission', modeShort: "n", color: '#9fd7ff' },
                    { mode: '2-neutron emission', modeShort: '2n', color: '#9fd7ff' },
                    { mode: 'electron capture (?)', modeShort: 'ec', color: '#ff7e75' }, // check
                    { mode: '2-electron capture (?)', modeShort: '2ec', color: '#ff7e75' }, //check
                    { mode: '\u03B2- decay', modeShort: 'b-', color: '#62aeff' },
                    { mode: 'doubble \u03B2- decay', modeShort: '2b-', color: '#62aeff' },
                    { mode: '\u03B2+ decay', modeShort: 'b+', color: '#ff7e75' },
                    { mode: 'internal transition', modeShort: 'it', color: '#ffffff' },
                    { mode: 'spontaneus fission', modeShort: 'sf', color: '#5cbc57' },
                    { mode: 'isotopic abundance', modeShort: 'is', color: '#000000' },
                    { mode: 'cluster', modeShort: 'cluster', color: '#a564cc' },
                    { mode: '?', modeShort: '?', color: '#cccccc' }];

                // Legend
                if (legendDiv) {
                    /* yield legend */
                    if (isThereYields) {
                        yieldLegendDiv = legendDiv.append("div").classed(legendDivClass, "true");
                        yieldLegendDiv
                            .append("span")
                            .text(compare ? (yields ? "Yield ratio" : "Production ratio") : (yields ? "Yield (μC\u207B\u00B9)" : "Production (μC\u207B\u00B9)"));
                        var legendWidth = 16;
                        var legendHeight = d3.max(legendRange);

                        var legendScale = d3.scaleLog()
                            .domain(yieldDomain)
                            .range(legendRange.slice().reverse());

                        var legendSvg = yieldLegendDiv.append("div")
                            .style("position", "relative")
                            .style("height", (d3.max(legendRange) + 20) + "px")
                                .append("svg")
                                    .style("position", "absolute")
                                    .attr("width", "100%")
                                    .attr("height", d3.max(legendRange) + 20);
                        var defs = legendSvg.append("defs");
                        var gradient = defs.append("linearGradient")
                            .attr("id", legendGradientId);
                        gradient
                            .attr("x1", "0%")
                            .attr("y1", "100%")
                            .attr("x2", "0%")
                            .attr("y2", "0%");
                        gradient.selectAll("stop")
                            .data(colorRange)
                            .enter()
                            .append("stop")
                            .attr("offset", function (d, i) { return i / (colorRange.length - 1); })
                            .attr("stop-color", function (d) { return d; });
                        var rect = legendSvg.append("rect")
                            .attr("y", 10)
                            .attr("width", legendWidth)
                            .attr("height", legendHeight)
                            .style("fill", "url(#" + legendGradientId + ")")
                            .style("stroke", "black");

                        var legendAxis = d3.axisRight(legendScale).ticks(compare ? 2 : 5);
                        if (compare) legendAxis.tickFormat(function (d) {
                            return d == 0.01 ? "0" : d == 1 ? "1" : d == 100 ? "≥ 100" : d3.format("d");
                        });

                        legendSvg.append("g")
                            .classed(legendAxisClass, true)
                            .attr("transform", "translate(" + legendWidth + ", " + 10 + ")")
                            .call(legendAxis);
                    }

                    if (isThereDecayModes) {
                        /* Decay mode legend */
                        var decayModeLegendDiv = legendDiv.append("div").classed(legendDivClass, "true");
                        decayModeLegendDiv.append("span").text("Decay modes");

                        var decayModeLegendDivs = decayModeLegendDiv.append("div").selectAll("div")
                            .data(decayModeColors2)
                            .enter()
                                .append("div");

                        decayModeLegendDivs.append("div")
                            .classed(decayModeLegendColorClass, true)
                            .style("background-color", function (d) { return d.color; });

                        decayModeLegendDivs.append("span")
                            .classed(legendTickClass, true)
                            .text(function (d) { return d.mode; });
                    }

                    /* Nuclide legend */
                    var nuclideLegendDiv = legendDiv.append("div").classed(legendDivClass, "true");
                    nuclideLegendDiv.append("span").text("Nuclide format");
                    var nuclideLegendSvg = nuclideLegendDiv.append("div")
                        .style("position", "relative")
                        .style("width", "65px")
                        .style("height", "84px")
                            .append("svg")
                                .style("position", "absolute")
                                .attr("width", "100%")
                                .attr("height", 80);

                    var nuclideMargin = (getSize(nuclideLegendSvg.node()).width - 64) / 2;
                    nuclideLegendG = nuclideLegendSvg.append("g");

                    nuclideLegendG.append("rect")
                        .attr("x", nuclideMargin)
                        .attr("y", 10)
                        .attr("width", 64)
                        .attr("height", 64)
                        .attr("fill", "white")
                        .attr("stroke", "grey")
                        .attr("stroke-width", 0.5)
                        .attr("shape-rendering", "crispEdges");

                    // Nuclide name
                    nuclideLegendG.append("text")
                        .text("Isotope")
                        .attr("x", nuclideMargin + 32)
                        .attr("y", 10 + 14)
                        .attr("font-size", 12)
                        .attr("text-anchor", "middle");

                    // Yield
                    if (isThereYields) {
                        nuclideLegendG.append("text")
                        .text(function (d) { return compare ? "ratio" : "yield (μC\u207B\u00B9)"; })
                        .attr("x", nuclideMargin + 32)
                        .attr("y", 10 + 24)
                        .attr("font-size", 8)
                        .attr("text-anchor", "middle");
                    }

                    // Half life
                    nuclideLegendG.append("text")
                        .classed(halfLifeClass, true)
                        .text("half life")
                        .attr("x", nuclideMargin + 32)
                        .attr("y", 10 + 34)
                        .attr("font-size", 8)
                        .attr("text-anchor", "middle");

                    // Decay mode
                    if (isThereDecayModes) {
                        nuclideLegendG.append("rect")
                        .classed(decayModeClass, true)
                        .attr("x", nuclideMargin + (3 / 4 * 64))
                        .attr("y", 10 + (3 / 4 * 64))
                        .attr("width", (1 / 4 * 64))
                        .attr("height", (1 / 4 * 64))
                        .attr("fill", "grey");
                    }
                }

                /* Draw the chart */

                // SVG  
                var svg = chartDiv
                    .append("div")
                        .attr("id", chartDivId)
                        .attr("style", "height: 100%")
                        .append("svg")
                            .attr("id", nuclideSVGId)
                            .attr("width", "100%")
                            .attr("height", "100%");

                // Chart
                var view = svg.append("g");

                // Nuclides
                var nuclide = view.selectAll("g")
                    .data(data)
                    .enter()
                    .append("g")
                        .attr("id", function (d) { return self.nuclideId(d); });

                // Rectangle

                // Set the fill function
                if (isThereYields) {
                    nuclideFill = function (d) {
                        if (d.Yield) {
                            if (compare) {
                                return parseFloat(d.Yield) == parseFloat(-1) ? colorScale(100) : colorScale(d.Yield);
                            } else {
                                return colorScale(d.Yield);
                            }
                        } else {
                            return "transparent";
                        }
                    }
                }

                function getBrightness(color) {
                    var rgb = color.substring(4, color.length - 1)
                        .replace(/ /g, '')
                        .split(',');

                    if (rgb.length != 3) {
                        console.error("Can't set text color of nuclide. Invalid format of background color: " + color);
                        return -1;
                    }

                    // https://www.w3.org/TR/AERT/#color-contrast
                    var brightness = ((rgb[0] * 299) + (rgb[1] * 587) + (rgb[2] * 144)) / 1000;
                    return brightness;
                }

                function getTextColor(d) {
                    var bgBrightness = getBrightness(nuclideFill(d));
                    if (bgBrightness < 120) {
                        return "white";
                    } else {
                        return "black";
                    }
                }

                nuclide.append("rect")
                    .attr("x", function (d) { return nuclideXPos(d); })
                    .attr("y", function (d) { return nuclideYPos(d); })
                    .attr("width", nuclideSize)
                    .attr("height", nuclideSize)
                    .style("fill", nuclideFill)
                    .style("stroke", "black")
                    .style("stroke-width", 0.5);

                // Nuclide name
                nuclide.append("text")
                    .text(function (d) { return nuclideName(d); })
                    .attr("x", function (d) { return nuclideXPos(d) + 32; })
                    .attr("y", function (d) { return nuclideYPos(d) + 14; })
                    .attr("font-size", 12)
                    .attr("text-anchor", "middle")
                    .attr("fill", getTextColor);

                // Yield
                if (isThereYields) {
                    nuclide.append("text")
                        .text(function (d) { return formatYield(d, compare ? "ratio" : "yield"); })
                        .attr("x", function (d) {
                            return nuclideXPos(d) + 32;
                        })
                        .attr("y", function (d) { return nuclideYPos(d) + 24; })
                        .attr("font-size", 8)
                        .attr("text-anchor", "middle")
                        .attr("fill", getTextColor);
                }

                // Half life
                nuclide.append("text")
                    .classed(halfLifeClass, true)
                    .text(function (d) { return d.HalflifeText; })
                    .attr("x", function (d) { return nuclideXPos(d) + 32; })
                    .attr("y", function (d) { return nuclideYPos(d) + 34; })
                    .attr("font-size", 8)
                    .attr("text-anchor", "middle")
                    .attr("fill", getTextColor);

                // Decay modes
                function decayModeColor(d) {
                    if (d.DecayMode) {
                        return decayModeColors[d.DecayMode.Mode];
                    }
                    return "transparent";
                }

                nuclide.append("rect")
                    .classed(decayModeClass, true)
                    .attr("x", function (d) { return nuclideXPos(d) + (3 / 4 * nuclideSize); })
                    .attr("y", function (d) { return nuclideYPos(d) + (3 / 4 * nuclideSize); })
                    .attr("width", (1 / 4 * nuclideSize))
                    .attr("height", (1 / 4 * nuclideSize))
                    .attr("fill", function (d) { return decayModeColor(d); });

                // Set visibility of decay modes based on checkbox
                d3.selectAll("." + decayModeClass)
                    .style("display", function () { return showDecayModes ? null : "none" });

                // Magic numbers
                var mNrOffset = 5;
                var mNrData = getMagicNumbers(data, magicNumbers);
                var lines = view.selectAll("line")
                    .data(mNrData)
                    .enter();

                lines.append("line")
                    .classed(magicNumberClass, true)
                    .attr("x1", function (d) { return (d.nr) * nuclideSize; })
                    .attr("y1", function (d) {
                        return d.limits.minZ < 1000 ? (-d.limits.minZ + 1 + mNrOffset) * nuclideSize : 0;
                    })
                    .attr("x2", function (d) { return d.nr * nuclideSize; })
                    .attr("y2", function (d) {
                        return d.limits.maxZ > -1000 ? (-d.limits.maxZ - mNrOffset) * nuclideSize : 0;
                    });

                lines.append("line")
                    .classed(magicNumberClass, true)
                    .attr("x1", function (d) { return (d.nr + 1) * nuclideSize; })
                    .attr("y1", function (d) {
                        return d.limits.minZ < 1000 ? (-d.limits.minZ + 1 + mNrOffset) * nuclideSize : 0;
                    })
                    .attr("x2", function (d) { return (d.nr + 1) * nuclideSize; })
                    .attr("y2", function (d) {
                        return d.limits.maxZ > -1000 ? (-d.limits.maxZ - mNrOffset) * nuclideSize : 0;
                    });

                lines.append("line")
                    .classed(magicNumberClass, true)
                    .attr("x1", function (d) {
                        return d.limits.minN < 1000 ? (d.limits.minN - mNrOffset) * nuclideSize : 0;
                    })
                    .attr("y1", function (d) { return -d.nr * nuclideSize; })
                    .attr("x2", function (d) {
                        return d.limits.maxN > -1000 ? (d.limits.maxN + 1 + mNrOffset) * nuclideSize : 0;
                    })
                    .attr("y2", function (d) { return -d.nr * nuclideSize; });

                lines.append("line")
                    .classed(magicNumberClass, true)
                    .attr("x1", function (d) {
                        return d.limits.minN < 1000 ? (d.limits.minN - mNrOffset) * nuclideSize : 0;
                    })
                    .attr("y1", function (d) { return -(d.nr - 1) * nuclideSize; })
                    .attr("x2", function (d) {
                        return d.limits.maxN > -1000 ? (d.limits.maxN + 1 + mNrOffset) * nuclideSize : 0;
                        debugger;
                    })
                    .attr("y2", function (d) { return -(d.nr - 1) * nuclideSize; });

                // Set visibility of magic number lines based on checkbox
                d3.selectAll("." + magicNumberClass)
                    .style("display", function () { return showMagicNumberLines ? null : "none"; });

                // Axes
                svg.append("rect")
                    .classed(chartAxisClass, true)
                    .attr("x", 0)
                    .attr("y", 0)
                    .attr("width", "100%")
                    .attr("height", "2em");

                svg.append("rect")
                    .classed(chartAxisClass, true)
                    .attr("x", 0)
                    .attr("y", "2em")
                    .attr("width", "2em")
                    .attr("height", "100%");

                var gX = svg.append("g").attr("class", "ncAxis").call(xAxis);
                var gY = svg.append("g").attr("class", "ncAxis").call(yAxis);

                /* Set up d3 zoom behavior */

                // Create the d3 zoom object
                zoom = d3.zoom().on("zoom", zoomed);

                // Calculate the initial zoom level so that the whole chart is shown as default
                var legendWidth = legendDiv ? getSize(legendDiv.node()).width : 0;
                var svgWidth = getSize(svg.node()).width - 6 * em - legendWidth;
                var svgHeight = getSize(svg.node()).height - 4 * em;

                var scaleX = svgWidth / (largestN * nuclideSize);
                var scaleY = svgHeight / (largestZ * nuclideSize);

                var s = Math.min(scaleX, scaleY);

                // Calculate where to move the chart as default
                var moveX = (svgWidth - ((largestN * nuclideSize) * s)) / 2;
                var moveY = (svgHeight - ((largestZ * nuclideSize) * s)) / 2;

                svg.call(zoom);
                svg.call(zoom.transform, d3.zoomIdentity.translate(moveX + 3 * em + legendWidth, svgHeight + 2 * em - moveY).scale(s));

                function zoomed() {
                    view.attr("transform", d3.event.transform);
                    gX.call(xAxis.scale(d3.event.transform.rescaleX(x)));
                    gY.call(yAxis.scale(d3.event.transform.rescaleY(y)));
                }
            } // draw
        }
    } // yieldChart
}