var model = {};

(function($){
    model = {
	init: function(){

	},

	load: function(){
		var lDefaultPrice = $.url().param("price");
		var lPropId = $.url().param("pid");

		if(lDefaultPrice){
			$("#targeted_cost").val(lDefaultPrice);
		}
		
		if(instanceExists("ali.webcounters")){
			if(lPropId==null){
				lPropId = 'SITE';
			}
            ali.webcounters.add_interaction('calculator',lPropId);
        }

		$("#btnProcessPayment").click(this.processPayment);
		$("#btnOwnershipCost").click(this.processOwnershipCost);

		this.processPayment();
	},

	processPayment: function(){
		var me = model;
		var lResult = me._process();


		me._showStringifyNumber({
			elm: "#result-periodic-payments .value", 
			value: lResult.payment,
			timeout: 1000,
			decimals: 2,
			format: $("#result").attr("data-format")
		})

		if(lResult.payment>1500){
			$("#result-periodic-payments .value").addClass("critical");
		}
		else{
			$("#result-periodic-payments .value").removeClass("critical");
		}

		$("#result-periodic-payments label").html($("#result-periodic-payments label").attr("data-payment-label"));
		me._showResult(lResult);
		$('#choice-context .noprint').removeClass('noprint');
		$('#btnOwnershipCost').parent().addClass('noprint');

		addGTMEvent('useCalculator',lResult);
	},

	processOwnershipCost: function(){
		var me = model;
		var lResult = me._process('p');

		me._showStringifyNumber({
			elm: "#result-periodic-payments .value", 
			value: lResult.targetedCost,
			timeout: 1000,
			decimals: 0,
			format: $("#result").attr("data-format")
		});

		if(lResult.targetedCost>500000){
			$("#result-periodic-payments .value").addClass("critical");
		}
		else{
			$("#result-periodic-payments .value").removeClass("critical");
		}

		$("#result-periodic-payments label").html($("#result-periodic-payments label").attr("data-cost-label"));
		me._showResult(lResult);
		$('#choice-context .noprint').removeClass('noprint');
		$('#btnProcessPayment').parent().addClass('noprint');
	},

	_showResult: function(data){
		var lDefaultFormat = $("#result").attr("data-format")
		$("#result-total-interest .value").html(String.format(lDefaultFormat,this._numToString(data.totalInterest)));
		$("#result-depreciation .value").html(String.format($("#result-depreciation").attr("data-format"),data.depreciation.toFixed(0)));
		$("#result-insurance .value").html(String.format(lDefaultFormat,this._numToString(data.insurance)))
		$("#result-downpayment .value").html(String.format($("#result-downpayment").attr("data-format"),this._numToString(data.downpaymentRatio * 100,2)))
		$("#result-terms-interest .value").html(String.format(lDefaultFormat,this._numToString(data.termInterest)));
		$("#result-terms-payment .value").html(String.format(lDefaultFormat,this._numToString(data.termPayment)));
		$("#result-terms-balance .value").html(String.format(lDefaultFormat,this._numToString(data.termBalance)));	
	},

	_getContext: function(){
		
		const lCost = parseFloat($("#targeted_cost").val());
		const lDownpayment = parseFloat($("#capital_outlay").val().replace(/\s/g,''));
		const lDownpaymentRatio = lDownpayment / lCost;
		
		const lMortgageInsurance = this.getMortgageInsurance(lCost, lDownpaymentRatio);

		const lResult = {
			nb_payments: $("#payment-cycle").val(),
			amortization: parseFloat($("#amortization").val()),
			interest: parseFloat($("#interest").val()/100),
			term: parseFloat($("#term").val()),
			term_periods: 0,
			targetedCost: lCost - lDownpayment + lMortgageInsurance,
			insurance: lMortgageInsurance,
			downpayment: lDownpayment,
			downpaymentRatio: lDownpaymentRatio,
			targetedPayments: parseFloat($("#targeted_payments").val()),
			total_periods: 0
		}

		lResult.term_periods = lResult.term * parseInt(lResult.nb_payments);
		lResult.total_periods = lResult.amortization*parseInt(lResult.nb_payments);

		return lResult;
	},

	getMortgageInsurance: function (price, downpayment_ratio) {
		const lBasePrice = price - (price * downpayment_ratio);
		const lBrackets = [
			{pct: 0.05, mult: 0.04},
			{pct: 0.1, mult: 0.031},
			{pct: 0.15, mult: 0.028},
			{pct: 0.1999, mult: 0.028},
			{pct: 0.2, mult: 0}
		];
		
		if(downpayment_ratio < 0.05){
			console.log('Downpayment ratio is inferior to the 5% limit');
			return 0;
		}
		
		let lBraket = null;
		lBrackets.forEach(function($b){
			console.log(downpayment_ratio, downpayment_ratio >= $b.pct);
			if(downpayment_ratio >= $b.pct){
				lBraket = $b;
			}
		})
		let lResult = 0;

		if(lBraket != null){
			lResult = lBasePrice * lBraket.mult;
		}		
		
		return lResult;
	},

	_process: function(pMode){
		
		var lResult = {};
		var lContext = this._getContext();
		
		var lDiffCalc = 99999;
		var lNewPayment = 0; //nouv paym
		var lCalcRate = 0.09; //taux calc

		// user entered a targeted payments
		if (pMode == "i" && lContext.targetedPayments > 0 ) {
			while (Math.abs(lDiffCalc) > 0.1 ) {
				lNewPayment = (parseFloat(lContext.targetedCost) * lCalcRate) / ( 1 - ( 1/ Math.pow((1+lCalcRate),lContext.total_periods)));
				lDiffCalc = (lContext.targetedPayments - lNewPayment);
				var lSign = (lDiffCalc) / Math.abs(lDiffCalc)
				lCalcRate =  (0.01 * lSign) * ( Math.abs(lDiffCalc) > 500 ) + (0.0001 * lSign) * ( Math.abs(lDiffCalc) > 20 ) +  (0.00001 * lSign) * ( Math.abs(lDiffCalc) > 10 ) + (0.000001 * lSign) * ( Math.abs(lDiffCalc) > 1 ) +(0.0000001 * lSign)  + lCalcRate;
			}
			lContext.interest =  2 * ( Math.pow((1+lCalcRate),parseInt(lContext.nb_payments)/2) - 1);  
			lContext.interest = parseInt(lContext.interest * 1000000)/10000;
		}

		var lCanInt = Math.pow((1+lContext.interest/2),(2/parseInt(lContext.nb_payments))) - 1;  

		var lCanBaseInterest = Math.pow((1+lContext.interest/2),(2/12)) - 1;  
		var lUsInt  = lContext.interest / parseInt(lContext.nb_payments);
		var lUsBaseInterest  = lContext.interest / 12;
	 	
		var lInterest = lCanInt;
		var lBaseInterest = lCanBaseInterest;

	 	// user entered a targeted cost
		if (pMode == "p" && lInterest != 0 ) {
			calcpaymdebase = lContext.targetedPayments;
			calcperiodes = parseInt(lContext.nb_payments);

			if ((lContext.nb_payments == '52a' ||lContext.nb_payments == '26a') && lInterest != 0 ) {
				var calcpaymdebase = lContext.targetedPayments * (parseInt(lContext.nb_payments)/13) ;
				lContext.targetedCost  = (calcpaymdebase/lBaseInterest) * ( 1 - (1/(Math.pow((1+lBaseInterest),(lContext.amortization*12))) ) ) ;
				
			} else {
				lContext.targetedCost  = (lContext.targetedPayments/lInterest) * ( 1 - (1/(Math.pow((1+lInterest),(lContext.total_periods))) ) ) ;
			}
		} 
		
		if (pMode == "p" && lInterest == 0 ) {
			lContext.targetedCost  = (lContext.targetedPayments*lContext.total_periods) ;
		} 

		var lMainCost   = parseFloat(lContext.targetedCost);
		var lBasePayment;

		if ( lInterest == 0 ) {
			lBasePayment  = lMainCost/ (lContext.amortization * 12) ;
		} else {
			console.log('lMainCost'+lMainCost)
			lBasePayment  = (lMainCost * lBaseInterest) / ( 1 - ( 1/ Math.pow((1+lBaseInterest),(lContext.amortization*12))));
		}		

		var lPayment = lBasePayment;
		//var paymusa  = paymbaseusa;

		if ((lContext.nb_payments == '52a' ||lContext.nb_payments == '26a') && lInterest != 0 ) {
			var lPayment = lBasePayment / (parseInt(lContext.nb_payments)/13) ;
		} 

		if ((lContext.nb_payments == '52' || lContext.nb_payments == '26'|| lContext.nb_payments == '2'|| lContext.nb_payments == '1' ) && lInterest != 0 ) {
			var lPayment = (lMainCost * lInterest) / ( 1 - ( 1/ Math.pow((1+lInterest),lContext.total_periods)));
		} 

		// start working here 

		lResult.targetedPayments = lPayment;
		// for US document.CalHypoCanMois.paymperiodique.value = Decimales(paymusa,2);
		lResult.payment = lPayment;//Decimales(lPayment,2); 
		// for US document.CalHypoCanMois.paymentusa.value  = Decimales(paymusa,2); 

		var lBalance = lContext.targetedCost;
		console.log('lContext.term_periods:'+lContext.term_periods);
		var lPrefinalInt = 0;
		var lFinalInt = 0;
	    for (var jj = 0; jj < lContext.term_periods ; jj++) {
		 	lPrefinalInt    = lInterest * lBalance;
			lFinalInt = lFinalInt + lPrefinalInt;
			lBalance    = lBalance - (lPayment - lPrefinalInt); 

			if (lBalance < 0 ) { 
				lBalance = 0 
				break;
			}
		}
		
		if (lBalance < 0 ) { lBalance = 0 };

		
		lResult.termBalance  = parseInt(lBalance);
		lResult.termInterest  = parseInt(lFinalInt);
		lResult.termPayment   = lMainCost-(parseInt(lBalance));	

		var kk = jj;
	    for (var jj = lContext.term_periods; jj < lContext.total_periods; jj++) {
		 	lPrefinalInt    = lInterest * lBalance;
			lFinalInt = lFinalInt + lPrefinalInt;
			lBalance    = lBalance - (lPayment - lPrefinalInt); 

			kk = jj;	

			if (lBalance < 0 ) { 
				lBalance = 0 
				break;
			}
		}

		var lFinalTerm = (kk+1)/parseInt(lContext.nb_payments);
		if (lInterest == 0 ) {
			lFinalTerm = lContext.amortization;
		}
		
		lResult.totalInterest = parseInt(lFinalInt); // ok
		lResult.targetedCost = lMainCost; 
		lResult.depreciation = lFinalTerm; //ok
		lResult.insurance = lContext.insurance;
		lResult.downpayment = lContext.downpayment;
		lResult.downpaymentRatio = lContext.downpaymentRatio;
		
		return lResult;
	},


	_getListOfNumber: function(start, end, step, format){
		var lResult = []
		for(var i=start;i<=end;i+=step){
			lResult.push({
				value: i,
				label: String.format(format,i)
			})
		}

		return lResult;
	},

	_getListFromElement: function(selector){
		var lResult = []
		$(selector).each(function(i,e){
			lResult.push({
				value: $(e).attr("data-value"),
				label: $(e).html()
			});
		});

		return lResult;
	},

	_showStringifyNumber:function(options){
		$(options.elm).data("iteration_count",32);
		var me = this;
		console.log(options.value);

		var lLoop = function(){
			var lCount = $(options.elm).data("iteration_count");

			if(lCount <=0){
				$(options.elm).html(String.format(options.format, me._numToString(options.value,options.decimals) ));
			}
			else{
				lNumber = (options.value / lCount);
				$(options.elm).html(String.format(options.format, me._numToString(lNumber,options.decimals) ) );
				$(options.elm).data("iteration_count",lCount-1);

				lIId = window.setTimeout(lLoop,options.timeout/32);
			}
		}

		var lIId = window.setTimeout(lLoop,options.timeout/32);
	},

	_numToString: function(value,decimals){
		decimals = decimals || 0;
		var lIntPart = Math.floor(value).toString();
		var lDecimals = Math.round((value - Math.floor(value))*Math.pow(10,decimals));

		var lResult = "";

		for(var i=1;i<=lIntPart.length;i++){
			var lChar = lIntPart[lIntPart.length-i];
			lResult = lChar + lResult;
			if(i%3==0){ lResult = " " + lResult;}
		}

		if(lDecimals!=0){
			lResult += "." + lDecimals;
		}
		return lResult
	}


}
})(jQuery);

model.init();
