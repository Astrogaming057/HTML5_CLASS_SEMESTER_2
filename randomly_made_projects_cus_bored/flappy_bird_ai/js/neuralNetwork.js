// Simple Neural Network for Flappy Bird AI
class NeuralNetwork {
    constructor(inputNodes, hiddenNodes, outputNodes) {
        this.inputNodes = inputNodes;
        this.hiddenNodes = hiddenNodes;
        this.outputNodes = outputNodes;
        
        // Initialize weights with random values
        this.weightsIH = this.randomMatrix(hiddenNodes, inputNodes);
        this.weightsHO = this.randomMatrix(outputNodes, hiddenNodes);
        
        // Biases
        this.biasH = this.randomMatrix(hiddenNodes, 1);
        this.biasO = this.randomMatrix(outputNodes, 1);
        
        // Learning rate - reduced to prevent weight explosion
        this.learningRate = 0.05;
    }
    
    randomMatrix(rows, cols) {
        const matrix = [];
        // Xavier/Glorot initialization for better training
        const limit = Math.sqrt(6.0 / (rows + cols));
        for (let i = 0; i < rows; i++) {
            matrix[i] = [];
            for (let j = 0; j < cols; j++) {
                // Xavier initialization: random between -limit and limit
                matrix[i][j] = (Math.random() * 2 - 1) * limit;
            }
        }
        return matrix;
    }
    
    // Clip gradients to prevent explosion
    clipGradient(gradient, maxNorm = 1.0) {
        const norm = Math.sqrt(gradient.reduce((sum, val) => sum + val * val, 0));
        if (norm > maxNorm) {
            return gradient.map(val => val * (maxNorm / norm));
        }
        return gradient;
    }
    
    sigmoid(x) {
        return 1 / (1 + Math.exp(-x));
    }
    
    dsigmoid(y) {
        return y * (1 - y);
    }
    
    // Forward propagation
    predict(inputArray) {
        // Convert input to matrix
        const inputs = inputArray.map(x => [x]);
        
        // Calculate hidden layer
        const hidden = this.matrixMultiply(this.weightsIH, inputs);
        this.addBias(hidden, this.biasH);
        this.applyActivation(hidden, this.sigmoid);
        
        // Calculate output layer
        const output = this.matrixMultiply(this.weightsHO, hidden);
        this.addBias(output, this.biasO);
        this.applyActivation(output, this.sigmoid);
        
        return output.map(row => row[0]);
    }
    
    // Train the network using backpropagation
    train(inputArray, targetArray) {
        // Forward pass
        const inputs = inputArray.map(x => [x]);
        
        const hidden = this.matrixMultiply(this.weightsIH, inputs);
        this.addBias(hidden, this.biasH);
        const hiddenOutputs = hidden.map(row => row.map(this.sigmoid));
        
        const output = this.matrixMultiply(this.weightsHO, hiddenOutputs);
        this.addBias(output, this.biasO);
        const outputs = output.map(row => row.map(this.sigmoid));
        
        // Convert targets to matrix
        const targets = targetArray.map(x => [x]);
        
        // Calculate output errors
        const outputErrors = [];
        for (let i = 0; i < this.outputNodes; i++) {
            outputErrors[i] = [(targets[i][0] - outputs[i][0]) * this.dsigmoid(outputs[i][0])];
        }
        
        // Calculate hidden layer errors
        const hiddenErrors = [];
        for (let i = 0; i < this.hiddenNodes; i++) {
            let error = 0;
            for (let j = 0; j < this.outputNodes; j++) {
                error += this.weightsHO[j][i] * outputErrors[j][0];
            }
            hiddenErrors[i] = [error * this.dsigmoid(hiddenOutputs[i][0])];
        }
        
        // Update weights and biases with gradient clipping and weight decay
        const weightDecay = 0.0001; // L2 regularization
        
        // Update weights from hidden to output
        for (let i = 0; i < this.outputNodes; i++) {
            for (let j = 0; j < this.hiddenNodes; j++) {
                const gradient = outputErrors[i][0] * hiddenOutputs[j][0];
                // Apply weight decay (L2 regularization)
                this.weightsHO[i][j] = this.weightsHO[i][j] * (1 - weightDecay) + this.learningRate * gradient;
                // Clip weights to prevent explosion
                this.weightsHO[i][j] = Math.max(-5, Math.min(5, this.weightsHO[i][j]));
            }
            const biasGradient = outputErrors[i][0];
            this.biasO[i][0] = this.biasO[i][0] * (1 - weightDecay) + this.learningRate * biasGradient;
            this.biasO[i][0] = Math.max(-5, Math.min(5, this.biasO[i][0]));
        }
        
        // Update weights from input to hidden
        for (let i = 0; i < this.hiddenNodes; i++) {
            for (let j = 0; j < this.inputNodes; j++) {
                const gradient = hiddenErrors[i][0] * inputs[j][0];
                // Apply weight decay (L2 regularization)
                this.weightsIH[i][j] = this.weightsIH[i][j] * (1 - weightDecay) + this.learningRate * gradient;
                // Clip weights to prevent explosion
                this.weightsIH[i][j] = Math.max(-5, Math.min(5, this.weightsIH[i][j]));
            }
            const biasGradient = hiddenErrors[i][0];
            this.biasH[i][0] = this.biasH[i][0] * (1 - weightDecay) + this.learningRate * biasGradient;
            this.biasH[i][0] = Math.max(-5, Math.min(5, this.biasH[i][0]));
        }
    }
    
    matrixMultiply(a, b) {
        const result = [];
        for (let i = 0; i < a.length; i++) {
            result[i] = [];
            for (let j = 0; j < b[0].length; j++) {
                let sum = 0;
                for (let k = 0; k < b.length; k++) {
                    sum += a[i][k] * b[k][j];
                }
                result[i][j] = sum;
            }
        }
        return result;
    }
    
    addBias(matrix, bias) {
        for (let i = 0; i < matrix.length; i++) {
            for (let j = 0; j < matrix[i].length; j++) {
                matrix[i][j] += bias[i][0];
            }
        }
    }
    
    applyActivation(matrix, func) {
        for (let i = 0; i < matrix.length; i++) {
            for (let j = 0; j < matrix[i].length; j++) {
                matrix[i][j] = func(matrix[i][j]);
            }
        }
    }
    
    // Save network to localStorage
    save(name) {
        const data = {
            weightsIH: this.weightsIH,
            weightsHO: this.weightsHO,
            biasH: this.biasH,
            biasO: this.biasO,
            inputNodes: this.inputNodes,
            hiddenNodes: this.hiddenNodes,
            outputNodes: this.outputNodes
        };
        localStorage.setItem(name, JSON.stringify(data));
    }
    
    // Load network from localStorage
    static load(name) {
        const dataStr = localStorage.getItem(name);
        if (!dataStr) return null;
        
        const data = JSON.parse(dataStr);
        const nn = new NeuralNetwork(data.inputNodes, data.hiddenNodes, data.outputNodes);
        nn.weightsIH = data.weightsIH;
        nn.weightsHO = data.weightsHO;
        nn.biasH = data.biasH;
        nn.biasO = data.biasO;
        return nn;
    }
    
    // Copy network
    copy() {
        const nn = new NeuralNetwork(this.inputNodes, this.hiddenNodes, this.outputNodes);
        nn.weightsIH = this.weightsIH.map(row => [...row]);
        nn.weightsHO = this.weightsHO.map(row => [...row]);
        nn.biasH = this.biasH.map(row => [...row]);
        nn.biasO = this.biasO.map(row => [...row]);
        return nn;
    }
    
    // Mutate network (for genetic algorithm)
    mutate(rate) {
        const mutateFunc = (val) => {
            if (Math.random() < rate) {
                return val + (Math.random() * 2 - 1) * 0.5;
            }
            return val;
        };
        
        for (let i = 0; i < this.weightsIH.length; i++) {
            for (let j = 0; j < this.weightsIH[i].length; j++) {
                this.weightsIH[i][j] = mutateFunc(this.weightsIH[i][j]);
            }
        }
        
        for (let i = 0; i < this.weightsHO.length; i++) {
            for (let j = 0; j < this.weightsHO[i].length; j++) {
                this.weightsHO[i][j] = mutateFunc(this.weightsHO[i][j]);
            }
        }
        
        for (let i = 0; i < this.biasH.length; i++) {
            this.biasH[i][0] = mutateFunc(this.biasH[i][0]);
        }
        
        for (let i = 0; i < this.biasO.length; i++) {
            this.biasO[i][0] = mutateFunc(this.biasO[i][0]);
        }
    }
}
