pipeline {
    agent none
    stages {
        stage('Format check') {
            agent {
                label "macos-1"
            }
            steps {
                catchError(buildResult: 'SUCCESS', stageResult: 'FAILURE')
                sh "git submodule update --init --recursive"
                sh "npm install"
                sh "npm run checkformat"
            }
        }
    }
}
