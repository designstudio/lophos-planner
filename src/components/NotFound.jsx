import { Link } from "react-router-dom";

export default function NotFound() {
    return (
        <>
            <h3>The page you’re looking
                for can’t be found</h3>
            <Link to="/">Go home</Link>
        </>
    )
}