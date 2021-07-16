pipeline {
    agent none
    stages {
        stage('Format check') {
            agent {
                label "ubuntu-1"
            }
            steps {
                catchError(buildResult: 'SUCCESS', stageResult: 'FAILURE') {
                    sh "git submodule update --init --recursive"
                    sh "npm install"
                    sh "npm run checkformat"
                }
            }
        }
        stage('WebAssembly compilation') {
            agent {
                label "ubuntu-1"
            }
            steps {
                catchError(buildResult: 'SUCCESS', stageResult: 'FAILURE') {
                    sh "git submodule update --init --recursive"
                    sh "npm run build-libs-docker"
                }
            }
        }
        stage('Build with node v12') {
            agent {
                label "ubuntu-1"
            }
            steps {
                catchError(buildResult: 'SUCCESS', stageResult: 'FAILURE') {
                    sh 'rm -rf node_modules build'
                    sh 'n 12'
                    sh 'node -v'
                    sh 'npm install'
                    sh 'npm run build-docker'
                }
            }
        }
        stage('Build with node v14') {
            agent {
                label "ubuntu-1"
            }
            steps {
                catchError(buildResult: 'SUCCESS', stageResult: 'FAILURE') {
                    sh 'rm -rf node_modules build'
                    sh 'n 14'
                    sh 'node -v'
                    sh 'npm install'
                    sh 'npm run build-docker'
                }
            }
        }
        stage('Build with node v16') {
            agent {
                label "ubuntu-1"
            }
            steps {
                catchError(buildResult: 'SUCCESS', stageResult: 'FAILURE') {
                    sh 'rm -rf node_modules build'
                    sh 'n 16'
                    sh 'node -v'
                    sh 'npm install'
                    sh 'npm run build-docker'
                }
            }
        }
    }
}
