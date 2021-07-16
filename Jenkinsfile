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
        stage('node v12') {
            agent {
                label "ubuntu-1"
            }
            steps {
                catchError(buildResult: 'SUCCESS', stageResult: 'FAILURE') {
                    sh 'rm -rf node_modules'
                    sh 'n 12'
                    sh 'node -v'
                    sh 'npm install'
                    sh 'npm run build-docker'
                }
            }
        }
    }
}
