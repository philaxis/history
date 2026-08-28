export type Point = {
	x: number;
	y: number;
};

export function isPointInTriangle(
	point: Point,
	first: Point,
	second: Point,
	third: Point,
): boolean {
	const cross = (left: Point, right: Point): number =>
		(point.x - right.x) * (left.y - right.y) -
		(left.x - right.x) * (point.y - right.y);
	const firstSign = cross(first, second);
	const secondSign = cross(second, third);
	const thirdSign = cross(third, first);

	return !(
		(firstSign < 0 || secondSign < 0 || thirdSign < 0) &&
		(firstSign > 0 || secondSign > 0 || thirdSign > 0)
	);
}
