# aws-sap-from-lambda
Calling into SAP Netweaver from AWS Lambda

Introduction in words

The objective of this project is to create an API Gateway front-end for accessing data from a backend SAP Netweaver system.  

## Objectives
- Has to be serverless (except for the SAP server)
- Has to scale, be highly available
- Able to cache responses to reduce calls to the back-end ERP system

## The Design
One of the challenges of acheiving the coveted "real-time inventory visibility" for public-facing applications is that it is nearly impossible to acheive.  Let's say that SAP ECC was your source of record for inventory and you indeed used all the local business processes to get that perpetual invnetory view.  You use sales orders, material movements, warehouse management features...Great!

The problem comes when you want to expose that real-time visibility to public-facing applications like a mobile app or web site.  Most implementations get around this by replicating a copy of inventory into a special "offline" copy that gets updated every so often.  This way, your public apps are hitting this shadow copy of inventory.

Well, this really isn't "real-time inventory" as your shadow copy is most likely out of phase with your SAP ECC copy.  If you take orders online, you still have a chance that inventory could be sold or transfered out from under that sales order leading to customer disappointment.

Using AWS API Gateway and Lamdba, we can build a service that reaches back into SAP ECC real-time to fetch the inventory.  Like a good lean warehouse, our warehouse processes are on a regular schedule--they don't randomly do activities.  Rather, they have waves of activities.  Receipts are done during a certain time.  Allocation runs are done on a fixed schedule.  Inventory is picked, packed and shipped on a given schedule.  Given how all these processes are interlaced, we know that inventory only significantly changes in certain intervals--lets say 10 minutes.

So, that means that we don't really have to call back to the SAP ECC system for every single query if we get the same query within a 10 minute period of time...we can cache the response.   AWS API Gateway allows us to do exactly that via its caching functionality!  We improve the response time to the calling application and reduce load on our ERP system too!

Like the other [SAP IDOC to AWS Lambda](https://github.com/ApplexusLabs/aws-sap-idoc-tricks) write-up, this is not meant to be production ready as-is.  We're not implementing any security, no encryption and no graceful failure if the SAP ECC endpoint is offline.  These types of things are well documented in other tutorials.  This is just meant to be a study in the specific interaction and integration between SAP Netweaver and AWS Services.

## The Steps
1. Create REST endpoint on SAP ECC to receive the call
2. Create Lambda routine to call the SAP ECC service
3. Create API Gateway as the front endpoint
4. Implement Caching on the API Gateway

## 1. Create REST Endpoint on SAP ECC
For our REST service on SAP ECC, we are going to create a few structures.

Next, we need to create a custom HTTP handler by creating a new class which inherits from ```CL_REST_HTTP_HANDLER```.  There is a quite detailed tutorial for doing this over at the [SAP Blog](https://blogs.sap.com/2013/01/24/developing-a-rest-api-in-abap/) so I'm just going to hit the highlights here.
```abap
method IF_REST_APPLICATION~GET_ROOT_HANDLER.

  DATA lo_handler TYPE REF TO cl_rest_router.
  CREATE OBJECT lo_handler.

  lo_handler->attach( iv_template = '/stock'  iv_handler_class = 'ZCL_AWS1_RES_STOCK' ).

  ro_root_handler = lo_handler.


endmethod.
```


## 2. Create Lambda Routine to bridge API Gateway to SAP ECC

## 3. Create API Gateway as the Front Endpoint

## 4. Implement Caching on the API Gateway
