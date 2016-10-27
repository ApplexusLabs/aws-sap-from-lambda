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
1. Create some structures for the REST service
2. Create REST endpoint on SAP ECC to receive the call
3. Create the backing ABAP code behind the SAP ECC REST endpoint
4. Configure the REST endpoint in SICF
5. Create Lambda routine to call the SAP ECC service
6. Create API Gateway as the front endpoint
7. Implement Caching on the API Gateway

## 1. Create some structures for the REST services
We need to create a couple strutures...one for the request and one for the response.
![stock_req](./img/stock_req.png)

![stock_res](./img/stock_res.png)

## 2. Create REST Endpoint on SAP ECC
For our REST service on SAP ECC, we are going to create a few structures.

Next, we need to create a custom HTTP handler ```ZCL_AWS1_REST_HANDLER``` by creating a new class which inherits from ```CL_REST_HTTP_HANDLER```.  There is a quite detailed tutorial for doing this over at the [SAP Community Blog](https://blogs.sap.com/2013/01/24/developing-a-rest-api-in-abap/) so I'm just going to hit the highlights here.
```abap
method IF_REST_APPLICATION~GET_ROOT_HANDLER.
  DATA lo_handler TYPE REF TO cl_rest_router.
  CREATE OBJECT lo_handler.
  lo_handler->attach( iv_template = '/stock'  iv_handler_class = 'ZCL_AWS1_RES_STOCK' ).
  ro_root_handler = lo_handler.
endmethod.
```
## 3. Create the backing ABAP code behind the SAP ECC REST endpoint
We need to create a ```GET``` and ```POST``` method for our new ```/stock``` endpoint.  We redefine the ```IF_REST_RESOURCE~GET``` method to fetch the CSRF token.

```abap
METHOD if_rest_resource~get.
  DATA: lo_entity       TYPE REF TO if_rest_entity,
        lv_current_time TYPE timestamp.
  GET TIME STAMP FIELD lv_current_time.
  mo_response->set_header_field( iv_name = 'Cache-Control' iv_value =  'no-cache, no-store, must-revalidate' ). "#EC NOTEXT
  mo_response->set_header_field(
    iv_name = 'ABAP-Execution-Time'                         "#EC NOTEXT
    iv_value = cl_rest_http_utils=>format_http_date( iv_timestamp = lv_current_time ) ).
  mo_response->set_status( cl_rest_status_code=>gc_success_ok ).
ENDMETHOD.
```
We also redefine the ```POST``` method to call the code which actually gets the inventory.  Notice we're collecting the query string params and passing them on to the method that does the actual inventory query.
```abap
METHOD if_rest_resource~post.

  DATA:   lv_json_i     TYPE string,
          lv_json_o     TYPE string,
          lv_current_time TYPE timestamp,
          lv_guid TYPE zcp_guid,
          lo_entity   TYPE REF TO if_rest_entity.

  DATA: ls_params TYPE zaws1_stock_req,
        lt_result TYPE zaws1_stock_res_t.

  GET TIME STAMP FIELD lv_current_time.

  lv_json_i = io_entity->get_string_data( ).

  zcl_aws1_json_util=>json_to_data( EXPORTING iv_json = lv_json_i
                                           IMPORTING es_data = ls_params ).

  lt_result = _get_stock( ls_params ).

  lv_json_o = zcl_aws1_json_util=>data_to_json( lt_result ).

** Response

  mo_response->set_header_field( iv_name = 'Cache-Control' iv_value =  'no-cache, no-store, must-revalidate' ). "#EC NOTEXT
  mo_response->set_header_field(
    iv_name = 'ABAP-Execution-Time'                         "#EC NOTEXT
    iv_value = cl_rest_http_utils=>format_http_date( iv_timestamp = lv_current_time ) ).

  lo_entity = me->mo_response->create_entity( ).

  lo_entity->set_modification_date( iv_modification_date = lv_current_time ).
  lo_entity->set_content_type( iv_media_type = if_rest_media_type=>gc_appl_json ).
  lo_entity->set_content_language( sy-langu ).
  lo_entity->set_string_data( lv_json_o ).
  mo_response->set_status( cl_rest_status_code=>gc_success_ok ).

  COMMIT WORK.

ENDMETHOD.
```

Finally, we come to the code that gets the stock based on the query string params in the POST.
```abap
METHOD _get_stock.

  CHECK is_params-plant IS NOT INITIAL.

  DATA:

     rt_plant TYPE  RANGE OF zaws1_stock_res-plant,
     rl_plant LIKE LINE OF rt_plant,

     rt_storage TYPE RANGE OF zaws1_stock_res-storage,
     rl_storage LIKE LINE OF rt_storage,

     rt_material TYPE RANGE OF zaws1_stock_res-material,
     rl_material LIKE LINE OF rt_material.

  DATA: lt_mard TYPE TABLE OF mard,
        lr_mard TYPE REF TO mard,
        lr_result TYPE REF TO zaws1_stock_res.

  rl_plant-sign = 'I'.
  rl_plant-option = 'EQ'.
  rl_plant-low = is_params-plant.
  APPEND rl_plant TO rt_plant.

  IF is_params-storage IS NOT INITIAL.
    rl_storage-sign = 'I'.
    rl_storage-option = 'EQ'.
    rl_storage-low = is_params-storage.
    APPEND rl_storage TO rt_storage.
  ENDIF.


  IF is_params-material IS NOT INITIAL.

    rl_material-sign = 'I'.
    rl_material-option = 'EQ'.

    CALL FUNCTION 'CONVERSION_EXIT_MATN1_INPUT'
      EXPORTING
        input              = is_params-material
     IMPORTING
        OUTPUT             = rl_material-low
     EXCEPTIONS
       OTHERS             = 2.
    APPEND rl_material TO rt_material.

  ENDIF.

  SELECT werks lgort matnr
    INTO TABLE lt_mard
    FROM mard
    WHERE werks IN rt_plant
      AND lgort IN rt_storage
      AND matnr IN rt_material.

  LOOP AT lt_mard REFERENCE INTO lr_mard.
    APPEND INITIAL LINE TO rs_result REFERENCE INTO lr_result.

    lr_result->plant    = lr_mard->werks.
    lr_result->storage  = lr_mard->lgort.
    lr_result->material = lr_mard->matnr.
    lr_result->quantity = lr_mard->labst.

    SELECT SINGLE meins
      INTO lr_result->uom
      FROM mara WHERE matnr = lr_mard->matnr.

    CALL FUNCTION 'CONVERSION_EXIT_CUNIT_OUTPUT'
      EXPORTING
        input  = lr_result->uom
      IMPORTING
        output = lr_result->uom
      EXCEPTIONS
        OTHERS = 2.

    SELECT SINGLE maktx
      INTO lr_result->materialname
      FROM makt
      WHERE matnr = lr_mard->matnr
        and spras = 'EN'.

  ENDLOOP.

ENDMETHOD.
```

## 4. Configure the REST endpoint in SICF
We next need to create the endpoint in ```tcode:SICF``` and assign our new handler class to the endpoint.

![sicf](./img/sicf.png)

## 5. Create Lambda Routine to bridge API Gateway to SAP ECC
The Lambda routine is just a simple call out to the REST services.  The specific code is located [in this repository] (./tree/master/src/lambda).  There is a bit of a trick in needing to fetch a CSRF token.  You can see this in the ```sapapi.js``` file.

```javascript
...
var headers = {
			'Authorization': sAuth,
			'x-csrf-token': "fetch"
		};

		var options = {
			host: extsys.host,
			port: extsys.port,
			path: endpoint,
			method: "GET",
			headers: headers
		};

		var req = http.request(options, function (res) {
			resolve(res);
		});
...
```
Then in the POST header:
```javascript
...
headers['X-CSRF-Token'] = oGetRes.headers['x-csrf-token'];
...
```

## 6. Create API Gateway as the Front Endpoint
We can now create the API Gateway that will catch the external calls and route them to the Lambda routing.  Notice that here I'm using a combination of URL Paths and Query Strings parameters.  No real reason other than just to show you can mix and match.  They are all just parameters in the ```$input.param``` variable from the API Gateway.

![apigw-setup](./img/apigw-setup.png)

Here you can see that we test out the call and we're able to get back an inventory number.

![apigw-test](./img/apigw-test.png)

## 7. Implement Caching on the API Gateway
Now for the easy part--caching.   