const pitch: {[key: string]: number} = {
	C: 523.25,
	Db: 554.37,
	D: 587.33,
	Eb: 622.25,
	E: 659.25,
	F: 698.46,
	Gb: 739.99,
	G: 783.99,
	Ab: 830.61,
	A: 880.00,
	Bb: 932.33,
	B: 987.77,
	C2: 1046.50
}

function findNearestPitch(freq: number): string {
    let result: string = "";

    if (freq <= 0) {
        return "";
    } else if (freq < pitch.C) {
        result = findNearestPitch(freq * 2);
    } else if (freq > pitch.C2) {
        result = findNearestPitch(freq / 2);
    } else {
        result = Object.entries(pitch).sort((a: [string, number], b: [string, number]) => {
            if (Math.abs(a[1] - freq) < Math.abs(b[1] - freq)) {
                return -1;
            }

            return 0;
        })[0][0];
    }

    return result;
}

export { findNearestPitch };