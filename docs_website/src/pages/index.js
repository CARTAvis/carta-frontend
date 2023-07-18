import React from "react";
import clsx from "clsx";
import Link from "@docusaurus/Link";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import Layout from "@theme/Layout";

import styles from "./index.module.css";

function HomepageHeader() {
    const {siteConfig} = useDocusaurusContext();
    return (
        <header className={clsx("hero hero--secondary", styles.heroBanner)}>
            <div className="container">
                <h1 className={clsx("hero__title", styles.heroTitle)}>{siteConfig.tagline}</h1>
                <div className={styles.buttons}>
                    <Link className="button button--primary button--lg" to="/docs/documents">
                        Documents
                    </Link>
                    <Link className="button button--primary button--lg" to="/api">
                        Frontend API
                    </Link>
                </div>
            </div>
        </header>
    );
}

function HomepageMain() {
    return (
        <section>
            <div className={clsx("container", styles.mainContainer)}>
                <p>
                    This is automatically generated documentation for the <a href="https://github.com/CARTAvis/carta-frontend">CARTA frontend component</a>.<br />
                    The intended audience for this site is code snippet users and the CARTA development team.
                </p>
                <h2>Documentation for other CARTA components</h2>
                <ul>
                    <li>
                        <a href="https://carta.readthedocs.io">CARTA user manual</a> (for users)
                    </li>
                    <li>
                        <a href="https://cartavis.org/carta-backend">CARTA backend</a> (for the development team)
                    </li>
                    <li>
                        <a href="https://carta-controller.readthedocs.io">CARTA controller</a> (for system administrators)
                    </li>
                    <li>
                        <a href="https://carta-python.readthedocs.io">CARTA Python scripting wrapper</a> (for users of the scripting interface){" "}
                    </li>
                </ul>
            </div>
        </section>
    );
}

export default function Home() {
    const {siteConfig} = useDocusaurusContext();
    return (
        <Layout>
            <HomepageHeader />
            <main>
                <HomepageMain />
            </main>
        </Layout>
    );
}
