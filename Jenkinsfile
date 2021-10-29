pipeline {
    agent none
    stages {
        stage('Format check') {
            agent {
                label "ubuntu-2004"
            }
            steps {
                catchError(buildResult: 'SUCCESS', stageResult: 'FAILURE') {
                    sh "git submodule update --init --recursive"
                    sh "n 12"
                    sh "n 14"
                    sh "n 16"
                    sh "n exec 14 npm install"
                    sh "n exec 14 npm run checkformat"
                }
            }
        }
        stage('WebAssembly compilation') {
            agent {
                label "ubuntu-2004"
            }
            steps {
                catchError(buildResult: 'SUCCESS', stageResult: 'FAILURE') {
                    sh "git submodule update --init --recursive"
                    sh "n exec 14 npm run build-libs-docker"
                    stash includes: "protobuf/**/*", name: "protobuf" 
                    stash includes: "wasm_libs/built/**/*", name: "wasm_libs"
                }
            }
        }
        stage('Build') {
            parallel {
                stage('Build with node v12') {
                    agent {
                        label "ubuntu-2004"
                    }
                    steps {
                        catchError(buildResult: 'SUCCESS', stageResult: 'FAILURE') {
                            unstash "protobuf"
                            unstash "wasm_libs"
                            sh 'rm -rf node_modules build'
                            sh 'n exec 12 node -v'
                            sh 'n exec 12 npm install'
                            sh 'n exec 12 npm run build-docker'
                        }
                    }
                }
                stage('Build with node v14') {
                    agent {
                        label "ubuntu-2004"
                    }
                    steps {
                        catchError(buildResult: 'SUCCESS', stageResult: 'FAILURE') {
                            unstash "protobuf"
                            unstash "wasm_libs"
                            sh 'rm -rf node_modules build'
                            sh 'n exec 14 node -v'
                            sh 'n exec 14 npm install'
                            sh 'n exec 14 npm run build-docker'
                        }
                    }
                }
                stage('Build with node v16') {
                    agent {
                       label "ubuntu-2004"
                    }
                    steps {
                        catchError(buildResult: 'SUCCESS', stageResult: 'FAILURE') {
                            unstash "protobuf"
                            unstash "wasm_libs"
                            sh 'rm -rf node_modules build'
                            sh 'n exec 16 node -v'
                            sh 'n exec 16 npm install'
                            sh 'n exec 16 npm run build-docker'
                        }
                    }
                }
            }
        }
    }
}
