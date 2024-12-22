'use strict';

/** ============================ Beam Analysis Data Type ============================ */

/**
 * Beam material specification.
 *
 * @param {String} name         Material name
 * @param {Object} properties   Material properties {EI : 0, GA : 0, ....}
 */
class Material {
    constructor(name, properties) {
        this.name = name;
        this.properties = properties;
    }
}

/**
 *
 * @param {Number} primarySpan          Beam primary span length
 * @param {Number} secondarySpan        Beam secondary span length
 * @param {Number} j2                   Beam J2 moment of inertia
 * @param {Material} material           Beam material object
 */
class Beam {
    constructor(primarySpan, secondarySpan, j2, material) {
        this.primarySpan = primarySpan;
        this.secondarySpan = secondarySpan;
        this.j2 = j2;
        this.material = material;
    }
}

/** ============================ Beam Analysis Class ============================ */

class BeamAnalysis {
    constructor() {
        this.options = {
            condition: 'simply-supported'
        };

        this.analyzer = {
            'simply-supported': new BeamAnalysis.analyzer.simplySupported(),
            'two-span-unequal': new BeamAnalysis.analyzer.twoSpanUnequal()
        };
    }
    /**
     *
     * @param {Beam} beam
     * @param {Number} load
     */
    getDeflection(beam, load, condition) {
        var analyzer = this.analyzer[condition];
        
        if (analyzer) {
            return {
                beam: beam,
                load: load,
                equation: analyzer.getDeflectionEquation(beam, load)
            };
        } else {
            throw new Error('Invalid condition');
        }
    }
    getBendingMoment(beam, load, condition) {
        var analyzer = this.analyzer[condition];

        if (analyzer) {
            return {
                beam: beam,
                load: load,
                equation: analyzer.getBendingMomentEquation(beam, load)
            };
        } else {
            throw new Error('Invalid condition');
        }
    }
    getShearForce(beam, load, condition) {
        var analyzer = this.analyzer[condition];

        if (analyzer) {
            return {
                beam: beam,
                load: load,
                equation: analyzer.getShearForceEquation(beam, load)
            };
        } else {
            throw new Error('Invalid condition');
        }
    }
}

const createChart = (canvasId, label, x, y, yLabel) => {
    const ctx = document.getElementById(canvasId).getContext('2d');
    new Chart(ctx, {
    type: 'line',
    data: {
        labels: x,
        datasets: [{
            label: label,
            data: y,
            borderColor: 'rgb(255, 15, 15)',
            borderWidth: 2,
            fill: true,
        }],
    },
    options: {
        responsive: true,
        plugins: {
            legend: {
                display: true,
                position: 'top',
            },
            tooltip: {
                callbacks: {
                    label: function (context) {
                        return `${yLabel}: ${context.raw.toFixed(2)}`;
                    },
                },
            },
        },
        scales: {
            x: {
                title: {
                    display: true,
                    text: 'Span (m)'
                }
            },
            y: {
                title: {
                    display: true,
                    text: yLabel
                }
            }
        },
    },
    });
}




/** ============================ Beam Analysis Analyzer ============================ */

/**
 * Available analyzers for different conditions
 */
BeamAnalysis.analyzer = {};

/**
 * Calculate deflection, bending stress and shear stress for a simply supported beam
 *
 * @param {Beam}   beam   The beam object
 * @param {Number}  load    The applied load
 */
BeamAnalysis.analyzer.simplySupported = class {
    constructor(beam, load) {
        this.beam = beam;
        this.load = load;
    }
    getDeflectionEquation(beam, load) {
        let x = [];
        let deflectionPlot = [];

        x = Array.from({ length: 101 }, (_, i) => (beam.primarySpan / 100) * i);
        deflectionPlot = x.map(
            (xi) => -((load * xi) / (24 * beam.material.properties.EI)) * (Math.pow(beam.primarySpan, 3) - 2 * beam.primarySpan * Math.pow(xi, 2) + Math.pow(xi, 3)) * beam.j2 * 1000
        );
        
        return createChart('deflection_plot', 'Deflection', x, deflectionPlot, 'Deflection (mm)');
    }
    getBendingMomentEquation(beam, load) {
        let x = [];
        let bendingMoment = [];        

        x = Array.from({ length: 101 }, (_, i) => (beam.primarySpan / 100) * i);
        bendingMoment = x.map((xi) => -((load * xi / 2) * (beam.primarySpan - xi)));

        return createChart('bending_moment_plot', 'Bending Moment', x, bendingMoment, 'Bending Moment (kNm)');
    }

    getShearForceEquation(beam, load) {
        let x = [];
        let shearForce = [];

        x = Array.from({ length: 101 }, (_, i) => (beam.primarySpan / 100) * i);
        shearForce = x.map((xi) => load * ((beam.primarySpan / 2) - xi)); 

        return createChart('shear_force_plot', 'Shear Force', x, shearForce, 'Shear Force (kN)');
    }
};


/**
 * Calculate deflection, bending stress and shear stress for a beam with two spans of equal condition
 *
 * @param {Beam}   beam   The beam object
 * @param {Number}  load    The applied load
 */
BeamAnalysis.analyzer.twoSpanUnequal = class {
    constructor(beam, load) {
        this.beam = beam;
        this.load = load;
    }
    getDeflectionEquation(beam, load) {
        let x = [];
        let deflectionPlot = [];

        let M1 = (load * (Math.pow(beam.secondarySpan, 3) - Math.pow(beam.primarySpan, 3))) / (8 * (beam.primarySpan + beam.secondarySpan));
        let R1 = M1 / beam.primarySpan + (load * beam.primarySpan) / 2;
        let R3 = M1 / beam.secondarySpan + (load * beam.secondarySpan) / 2;
        let R2 = load * (beam.primarySpan + beam.secondarySpan) - R1 - R3;

        x = Array.from({ length: 101 }, (_, i) => ((beam.primarySpan + beam.secondarySpan) / 100) * i);

        deflectionPlot = x.map((xi) => {
            if (xi >= beam.primarySpan) {
                return (
                    ((xi / (24 * (beam.material.properties.EI / 1e9))) *
                        (4 * R1 * xi * xi - load * Math.pow(xi, 3) + load * Math.pow(beam.primarySpan, 3) - 4 * R1 * Math.pow(beam.primarySpan, 2))) *
                    1000 *
                    beam.j2
                );
            } else {
                let xFromdata = xi - beam.primarySpan;
                return (
                    ((xFromdata / (24 * (beam.material.properties.EI / 1e9))) *
                        (4 * R3 * Math.pow(xFromdata, 2) - load * Math.pow(xFromdata, 3) + load * Math.pow(beam.secondarySpan, 3) - 4 * R3 * Math.pow(beam.secondarySpan, 2))) *
                    1000 *
                    beam.j2
                );
            }
        });

        return createChart('deflection_plot', 'Deflection', x, deflectionPlot, 'Deflection (mm)');
    }

    getBendingMomentEquation(beam, load) {
        let x = [];
        let bendingMoment = [];
        let M1 = (load * (Math.pow(beam.secondarySpan, 3) - Math.pow(beam.primarySpan, 3))) / (8 * (beam.primarySpan + beam.secondarySpan));
        let R1 = M1 / beam.primarySpan + (load * beam.primarySpan) / 2;
        let R3 = M1 / beam.secondarySpan + (load * beam.secondarySpan) / 2;
        let R2 = load * (beam.primarySpan + beam.secondarySpan) - R1 - R3;

        x = Array.from({ length: 101 }, (_, i) => ((beam.primarySpan + beam.secondarySpan) / 100) * i);

        bendingMoment = x.map((xi) => {
            if (xi <= beam.primarySpan) {
                return R1 * xi - (load * Math.pow(xi, 2)) / 2;
            } else {
                return R3 * (beam.primarySpan + beam.secondarySpan - xi) - (load * Math.pow(beam.primarySpan + beam.secondarySpan - xi, 2)) / 2;
            }
        });

        return createChart('bending_moment_plot', 'Bending Moment', x, bendingMoment, 'Bending Moment (kNm)');
    }
    getShearForceEquation(beam, load) {
        let x = [];
        let shearForce = [];
        let M1 = (load * (Math.pow(beam.secondarySpan, 3) - Math.pow(beam.primarySpan, 3))) / (8 * (beam.primarySpan + beam.secondarySpan));
        let R1 = M1 / beam.primarySpan + (load * beam.primarySpan) / 2;
        let R3 = M1 / beam.secondarySpan + (load * beam.secondarySpan) / 2;
        let R2 = load * (beam.primarySpan + beam.secondarySpan) - R1 - R3;

        x = Array.from({ length: 101 }, (_, i) => ((beam.primarySpan + beam.secondarySpan) / 100) * i);

        shearForce = x.map((xi) => {
            if (xi === 0) {
                return R1;
            } else if (xi > 0 && xi < beam.primarySpan) {
                return R1 - load * xi;
            } else if (xi === beam.primarySpan) {
                return R1 - load * beam.primarySpan;
            } else if (xi > beam.primarySpan && xi < beam.primarySpan + beam.secondarySpan) {
                return R1 + R2 - load * xi;
            } else {
                return R1 + R2 - load * (beam.primarySpan + beam.secondarySpan);
            }
        });

        return createChart('shear_force_plot', 'Shear Force', x, shearForce, 'Shear Force (kN)');
    }
};